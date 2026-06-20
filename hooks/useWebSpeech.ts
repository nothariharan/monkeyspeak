'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useTestStore } from '@/store/testStore'
import { isFiller } from '@/lib/fillers'
import {
  buildOnstartFailureMessage,
  buildSpeechErrorMessage,
  allowsSlowStartRetry,
  getSpeechRecognitionCtor,
  prepareBrowserSpeech,
  sleep,
  waitForRecognitionStart,
  type BrowserSpeechProfile,
} from '@/lib/browserSpeech'
import type { SpeechProvider, SessionStartResult } from './useSpeechProvider'

const MAX_NETWORK_RETRIES = 3
const STALL_MS = 8000
const AUDIO_ACTIVE_DECAY_MS = 1200

function normalizeSpokenToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
}

function tokenizeInterim(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function toRealWords(rawWords: string[]): string[] {
  const out: string[] = []
  for (const w of rawWords) {
    const norm = normalizeSpokenToken(w)
    if (!norm || isFiller(norm)) continue
    out.push(norm)
  }
  return out
}

/** Append spoken words without duplicating overlap at the boundary. */
function appendUniqueWords(prev: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return prev
  let overlap = 0
  for (let k = Math.min(prev.length, incoming.length); k > 0; k--) {
    let match = true
    for (let i = 0; i < k; i++) {
      if (prev[prev.length - k + i] !== incoming[i]) {
        match = false
        break
      }
    }
    if (match) {
      overlap = k
      break
    }
  }
  if (overlap === incoming.length) return prev
  return [...prev, ...incoming.slice(overlap)]
}

/** Concatenate every result segment (final + interim) into one live transcript. */
function cumulativeTranscript(results: SpeechRecognitionResultList): string {
  let text = ''
  for (let i = 0; i < results.length; i++) {
    text += results[i]?.[0]?.transcript ?? ''
  }
  return text.trim()
}

/**
 * Browser Web Speech API shaped to the SpeechProvider interface.
 *
 * Mic permission is requested via getUserMedia then tracks are stopped immediately.
 * SpeechRecognition owns the live mic — no parallel MediaStream is kept.
 */
export function useWebSpeech(): SpeechProvider {
  const { settings } = useTestStore()

  const [interimText, setInterimText] = useState('')
  const [previewWords, setPreviewWords] = useState<string[]>([])
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [audioActive, setAudioActive] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const listeningRef = useRef(false)
  const previewWordsRef = useRef<string[]>([])
  const stableConfirmedCountRef = useRef(0)
  const singleTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSingleTokenRef = useRef<string | null>(null)
  const networkRetryRef = useRef(0)
  const lastResultAtRef = useRef(0)
  const sessionStartedAtRef = useRef(0)
  const startedRef = useRef(false)
  const profileRef = useRef<BrowserSpeechProfile>({
    isBrave: false,
    isEdge: false,
    preferDeepgram: false,
    onstartTimeoutMs: 3000,
  })
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioActiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const respawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSingleTokenTimer = useCallback(() => {
    if (singleTokenTimerRef.current != null) {
      clearTimeout(singleTokenTimerRef.current)
      singleTokenTimerRef.current = null
    }
    pendingSingleTokenRef.current = null
  }, [])

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current != null) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const clearRespawnTimer = useCallback(() => {
    if (respawnTimerRef.current != null) {
      clearTimeout(respawnTimerRef.current)
      respawnTimerRef.current = null
    }
  }, [])

  const pulseAudioActive = useCallback(() => {
    setAudioActive(true)
    if (audioActiveTimerRef.current != null) {
      clearTimeout(audioActiveTimerRef.current)
    }
    audioActiveTimerRef.current = setTimeout(() => {
      audioActiveTimerRef.current = null
      setAudioActive(false)
    }, AUDIO_ACTIVE_DECAY_MS)
  }, [])

  const reset = useCallback(() => {
    clearSingleTokenTimer()
    clearWatchdog()
    clearRespawnTimer()
    if (audioActiveTimerRef.current != null) {
      clearTimeout(audioActiveTimerRef.current)
      audioActiveTimerRef.current = null
    }
    stableConfirmedCountRef.current = 0
    networkRetryRef.current = 0
    startedRef.current = false
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    setConfirmedWords([])
    setFillerCount(0)
    setError(null)
    setAudioActive(false)
  }, [clearSingleTokenTimer, clearWatchdog, clearRespawnTimer])

  const stopSession = useCallback(() => {
    clearSingleTokenTimer()
    clearWatchdog()
    clearRespawnTimer()
    if (audioActiveTimerRef.current != null) {
      clearTimeout(audioActiveTimerRef.current)
      audioActiveTimerRef.current = null
    }
    listeningRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setMicStream(null)
    setIsListening(false)
    setAudioActive(false)
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    stableConfirmedCountRef.current = 0
    networkRetryRef.current = 0
    startedRef.current = false
  }, [clearSingleTokenTimer, clearWatchdog, clearRespawnTimer])

  const promoteStableTokens = useCallback((tokens: string[]) => {
    const stable =
      tokens.length > 1
        ? toRealWords(tokens.slice(0, -1))
        : []

    if (stable.length > stableConfirmedCountRef.current) {
      const newStable = stable.slice(stableConfirmedCountRef.current)
      stableConfirmedCountRef.current = stable.length
      if (newStable.length > 0) {
        setConfirmedWords((prev) => [...prev, ...newStable])
      }
    }
  }, [])

  const scheduleSingleTokenPromotion = useCallback((token: string) => {
    const norm = normalizeSpokenToken(token)
    if (!norm || isFiller(norm)) {
      clearSingleTokenTimer()
      return
    }
    if (pendingSingleTokenRef.current === norm && singleTokenTimerRef.current != null) return

    clearSingleTokenTimer()
    pendingSingleTokenRef.current = norm
    singleTokenTimerRef.current = setTimeout(() => {
      singleTokenTimerRef.current = null
      pendingSingleTokenRef.current = null
      setConfirmedWords((prev) => {
        if (prev[prev.length - 1] === norm) return prev
        return [...prev, norm]
      })
    }, 200)
  }, [clearSingleTokenTimer])

  const failSession = useCallback((msg: string) => {
    listeningRef.current = false
    clearSingleTokenTimer()
    clearWatchdog()
    clearRespawnTimer()
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setError(msg)
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    setIsListening(false)
    setAudioActive(false)
    startedRef.current = false
  }, [clearSingleTokenTimer, clearWatchdog, clearRespawnTimer])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      const msg = 'Web Speech API not supported in this browser (use Chrome or Edge)'
      setError(msg)
      return { ok: false, error: msg }
    }

    if (listeningRef.current && recognitionRef.current && startedRef.current) {
      return { ok: true }
    }

    const lang = settings.language ?? 'en-US'
    const prep = await prepareBrowserSpeech(lang)
    profileRef.current = prep.profile
    if (prep.permissionError) {
      setError(prep.permissionError)
      return { ok: false, error: prep.permissionError }
    }

    clearSingleTokenTimer()
    stableConfirmedCountRef.current = 0
    setMicStream(null)
    setError(null)
    setIsListening(false)
    startedRef.current = false
    networkRetryRef.current = 0
    lastResultAtRef.current = Date.now()
    sessionStartedAtRef.current = Date.now()
    listeningRef.current = true

    const spawnRecognition = (): boolean => {
      if (!listeningRef.current) return false

      const SpeechCtor = getSpeechRecognitionCtor()
      if (!SpeechCtor) return false

      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }

      const recognition = new SpeechCtor()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = lang

      recognition.onstart = () => {
        startedRef.current = true
        setIsListening(true)
        setError(null)
      }

      recognition.onaudiostart = () => {
        pulseAudioActive()
      }

      recognition.onspeechstart = () => {
        pulseAudioActive()
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        lastResultAtRef.current = Date.now()
        pulseAudioActive()

        const live = cumulativeTranscript(event.results)
        const tokens = live.length > 0 ? tokenizeInterim(live) : []

        const previewBatch = toRealWords(tokens)
        if (previewBatch.length === 0) {
          previewWordsRef.current = []
          setPreviewWords([])
        } else if (previewBatch.length >= previewWordsRef.current.length) {
          previewWordsRef.current = previewBatch
          setPreviewWords(previewBatch)
        }

        promoteStableTokens(tokens)

        if (tokens.length === 1) {
          scheduleSingleTokenPromotion(tokens[0]!)
        } else {
          clearSingleTokenTimer()
        }

        const finalBatch: string[] = []
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          if (r?.isFinal) {
            clearSingleTokenTimer()
            const t = r[0]?.transcript?.trim() ?? ''
            if (t) finalBatch.push(...t.split(/\s+/).filter(Boolean))
          }
        }

        if (finalBatch.length > 0) {
          let newFillers = 0
          const realWords: string[] = []
          for (const w of finalBatch) {
            const norm = normalizeSpokenToken(w)
            if (!norm) continue
            if (isFiller(norm)) newFillers++
            else realWords.push(norm)
          }
          if (newFillers > 0) setFillerCount((c) => c + newFillers)
          if (realWords.length > 0) {
            setConfirmedWords((prev) => appendUniqueWords(prev, realWords))
          }
          stableConfirmedCountRef.current = 0
          previewWordsRef.current = []
          setPreviewWords([])
        }

        setInterimText(live)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return

        if (event.error === 'network' && networkRetryRef.current < MAX_NETWORK_RETRIES) {
          networkRetryRef.current++
          recognitionRef.current = null
          clearRespawnTimer()
          respawnTimerRef.current = setTimeout(() => {
            respawnTimerRef.current = null
            spawnRecognition()
          }, 400 * networkRetryRef.current)
          return
        }

        failSession(buildSpeechErrorMessage(event.error, profileRef.current))
      }

      recognition.onend = () => {
        if (!listeningRef.current) return
        recognitionRef.current = null
        clearRespawnTimer()
        respawnTimerRef.current = setTimeout(() => {
          respawnTimerRef.current = null
          if (listeningRef.current) spawnRecognition()
        }, 120)
      }

      try {
        recognition.start()
        return true
      } catch {
        recognitionRef.current = null
        return false
      }
    }

    if (!spawnRecognition()) {
      listeningRef.current = false
      const msg = 'Could not start speech recognition'
      setError(msg)
      return { ok: false, error: msg }
    }

    const startTimeout = profileRef.current.onstartTimeoutMs

    const waitUntilReady = async (): Promise<boolean> => {
      if (await waitForRecognitionStart(() => startedRef.current, startTimeout)) return true
      if (!allowsSlowStartRetry(profileRef.current)) return false

      startedRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
      }
      recognitionRef.current = null
      await sleep(500)
      if (!spawnRecognition()) return false
      return waitForRecognitionStart(() => startedRef.current, startTimeout)
    }

    const ready = await waitUntilReady()
    if (!ready) {
      const msg = buildOnstartFailureMessage(profileRef.current)
      failSession(msg)
      return { ok: false, error: msg }
    }

    clearWatchdog()
    watchdogRef.current = setInterval(() => {
      if (!listeningRef.current) return
      const sinceResult = Date.now() - lastResultAtRef.current
      const sinceSession = Date.now() - sessionStartedAtRef.current
      if (sinceSession > STALL_MS && sinceResult > STALL_MS) {
        lastResultAtRef.current = Date.now()
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch { /* ignore */ }
        }
        recognitionRef.current = null
        spawnRecognition()
      }
    }, 2000)

    return { ok: true }
  }, [
    settings.language,
    clearSingleTokenTimer,
    promoteStableTokens,
    scheduleSingleTokenPromotion,
    pulseAudioActive,
    failSession,
    clearWatchdog,
    clearRespawnTimer,
  ])

  useEffect(() => () => { stopSession() }, [stopSession])

  return {
    interimText,
    previewWords,
    confirmedWords,
    fillerCount,
    isListening,
    error,
    micStream,
    audioActive,
    startSession,
    stopSession,
    reset,
    onSpeechStart: () => {},
    onSpeechEnd: () => {},
  }
}
