'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useTestStore } from '@/store/testStore'
import { isFiller } from '@/lib/fillers'
import type { SpeechProvider, SessionStartResult } from './useSpeechProvider'

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

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
 * Does NOT open getUserMedia — SpeechRecognition owns the mic on its own.
 * A parallel getUserMedia stream prevents recognition on many Windows setups.
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

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const listeningRef = useRef(false)
  const previewWordsRef = useRef<string[]>([])
  const stableConfirmedCountRef = useRef(0)
  const singleTokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSingleTokenRef = useRef<string | null>(null)

  const clearSingleTokenTimer = useCallback(() => {
    if (singleTokenTimerRef.current != null) {
      clearTimeout(singleTokenTimerRef.current)
      singleTokenTimerRef.current = null
    }
    pendingSingleTokenRef.current = null
  }, [])

  const reset = useCallback(() => {
    clearSingleTokenTimer()
    stableConfirmedCountRef.current = 0
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    setConfirmedWords([])
    setFillerCount(0)
    setError(null)
  }, [clearSingleTokenTimer])

  const stopSession = useCallback(() => {
    clearSingleTokenTimer()
    listeningRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setMicStream(null)
    setIsListening(false)
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    stableConfirmedCountRef.current = 0
  }, [clearSingleTokenTimer])

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
    }, 450)
  }, [clearSingleTokenTimer])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      const msg = 'Web Speech API not supported in this browser (use Chrome or Edge)'
      setError(msg)
      return { ok: false, error: msg }
    }

    if (listeningRef.current && recognitionRef.current) return { ok: true }

    try {
      clearSingleTokenTimer()
      stableConfirmedCountRef.current = 0
      setMicStream(null)

      const lang = settings.language ?? 'en-US'
      const recognition = new Ctor()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = lang

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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
        listeningRef.current = false
        clearSingleTokenTimer()
        setError(
          event.error === 'not-allowed'
            ? 'Microphone permission denied — allow mic access for this site'
            : event.error === 'network'
              ? 'Speech recognition needs an internet connection'
              : `Speech recognition error: ${event.error}`
        )
        recognitionRef.current = null
        setInterimText('')
        previewWordsRef.current = []
        setPreviewWords([])
        setIsListening(false)
      }

      recognition.onend = () => {
        if (!listeningRef.current || !recognitionRef.current) return
        window.setTimeout(() => {
          if (!listeningRef.current || !recognitionRef.current) return
          try { recognitionRef.current.start() } catch { /* already started */ }
        }, 300)
      }

      listeningRef.current = true
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        recognitionRef.current = null
        setIsListening(false)
        const msg = 'Could not start speech recognition'
        setError(msg)
        return { ok: false, error: msg }
      }

      setIsListening(true)
      return { ok: true }
    } catch (err: unknown) {
      const msg = 'Could not start speech recognition'
      setError(msg)
      recognitionRef.current = null
      listeningRef.current = false
      previewWordsRef.current = []
      setPreviewWords([])
      return { ok: false, error: msg }
    }
  }, [settings.language, clearSingleTokenTimer, promoteStableTokens, scheduleSingleTokenPromotion])

  useEffect(() => () => { stopSession() }, [stopSession])

  return {
    interimText,
    previewWords,
    confirmedWords,
    fillerCount,
    isListening,
    error,
    micStream,
    startSession,
    stopSession,
    reset,
    onSpeechStart: () => {},
    onSpeechEnd: () => {},
  }
}
