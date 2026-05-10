'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useTestStore } from '@/store/testStore'
import { tokensRoughlyMatch } from '@/lib/wordMatch'
import { isFiller } from '@/lib/fillers'
import { emitDebugLog } from '@/lib/debugLog'
import type { SpeechProvider } from './useSpeechProvider'

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Short-lived recognition start/stop to warm the browser + cloud pipeline (best-effort).
 * Uses a separate instance from the live session.
 */
export function prewarmWebSpeechRecognition(lang: string): Promise<void> {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return Promise.resolve()

  return new Promise((resolve) => {
    const r = new Ctor()
    r.continuous = false
    r.interimResults = false
    r.lang = lang
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      try {
        r.onstart = null
        r.onend = null
        r.onerror = null
        r.abort()
      } catch {
        // ignore
      }
      resolve()
    }
    r.onstart = () => { window.setTimeout(done, 120) }
    r.onend = () => done()
    r.onerror = () => done()
    window.setTimeout(done, 2500)
    try { r.start() } catch { done() }
  })
}

/**
 * Browser Web Speech API shaped to the SpeechProvider interface.
 *
 * Confirmed words are final-only (monotonic). Interim complete tokens are kept
 * only in `interimEmittedTokensRef` for final-batch dedupe, not merged into
 * confirmed state (visual speculation lives in useSpeculativeMatch).
 *  - prewarm on startSession
 *  - continuous restart on onend
 *
 * Filler detection now happens inside this hook so the interface is self-contained.
 */
export function useWebSpeech(): SpeechProvider {
  const { settings } = useTestStore()
  const debugRunIdRef = useRef('post-fix')

  const [interimText, setInterimText] = useState('')
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const listeningRef = useRef(false)

  /** Complete interim tokens (not the trailing partial); used to strip finals only. */
  const interimEmittedTokensRef = useRef<string[]>([])
  const interimDebounceRef = useRef<number | null>(null)

  const clearInterimDebounce = useCallback(() => {
    if (interimDebounceRef.current != null) {
      window.clearTimeout(interimDebounceRef.current)
      interimDebounceRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearInterimDebounce()
    interimEmittedTokensRef.current = []
    setInterimText('')
    setConfirmedWords([])
    setFillerCount(0)
    setError(null)
  }, [clearInterimDebounce])

  const debugLog = useCallback(
    (hypothesisId: string, location: string, message: string, data: Record<string, unknown>) => {
      emitDebugLog({
        sessionId: '26db2b',
        runId: debugRunIdRef.current,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      })
    },
    []
  )

  const stopSession = useCallback(() => {
    listeningRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMicStream(null)
    setIsListening(false)
    clearInterimDebounce()
    setInterimText('')
    interimEmittedTokensRef.current = []
  }, [clearInterimDebounce])

  const startSession = useCallback(async (): Promise<boolean> => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('Web Speech API not supported in this browser')
      return false
    }

    if (listeningRef.current && recognitionRef.current) return true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      })
      streamRef.current = stream
      setMicStream(stream)

      const lang = settings.language ?? 'en-US'
      prewarmWebSpeechRecognition(lang).catch(() => {})

      const recognition = new Ctor()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = lang

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          if (!r) continue
          if (!r.isFinal) interim += r[0]?.transcript ?? ''
        }
        const interimTrim = interim.trim()

        if (interimTrim.length === 0) {
          interimEmittedTokensRef.current = []
        } else {
          const tokens = interimTrim
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(Boolean)
          if (tokens.length > 1) {
            const safeTokens = tokens.slice(0, -1)
            interimEmittedTokensRef.current = safeTokens
            debugLog(
              'H1_final_only_confirmed',
              'hooks/useWebSpeech.ts:onresult:interimPrefix',
              'Interim complete tokens tracked for final dedupe only (not merged into confirmed)',
              {
                safeTokensLength: safeTokens.length,
                safeTokensPreview: safeTokens.slice(0, 6),
              }
            )
          } else {
            interimEmittedTokensRef.current = []
          }
        }

        // ── Handle new finals ──────────────────────────────────────────────
        let hasNewFinal = false
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i]?.isFinal) { hasNewFinal = true; break }
        }
        if (hasNewFinal) {
          clearInterimDebounce()
          setInterimText('')
        }

        const finalBatch: string[] = []
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          if (r.isFinal) {
            const t = r[0]?.transcript?.trim() ?? ''
            if (t) {
              for (const w of t.split(/\s+/)) {
                const trimmed = w.trim()
                if (trimmed) finalBatch.push(trimmed)
              }
            }
          }
        }

        if (finalBatch.length > 0) {
          // De-duplicate tokens already emitted via interim prefix
          const pref = interimEmittedTokensRef.current
          let i = 0
          while (
            i < finalBatch.length &&
            i < pref.length &&
            tokensRoughlyMatch(finalBatch[i]!, pref[i]!)
          ) { i++ }
          const suffix = finalBatch.slice(i)
          debugLog(
            'H2_dedupe_disconnect',
            'hooks/useWebSpeech.ts:onresult:dedupe',
            'Final batch dedupe against interim prefix',
            {
              finalBatchLength: finalBatch.length,
              finalBatchPreview: finalBatch.slice(0, 8),
              interimPrefixLength: pref.length,
              interimPrefixPreview: pref.slice(0, 8),
              dedupePrefixMatches: i,
              suffixLength: suffix.length,
              suffixPreview: suffix.slice(0, 8),
            }
          )

          if (suffix.length > 0) {
            // Detect fillers and accumulate into state
            let newFillers = 0
            const realWords: string[] = []
            for (const w of suffix) {
              if (isFiller(w)) { newFillers++ } else { realWords.push(w) }
            }
            if (newFillers > 0) setFillerCount((c) => c + newFillers)
            if (realWords.length > 0) {
              setConfirmedWords((prev) => {
                const next = [...prev, ...realWords]
                debugLog(
                  'H2_dedupe_disconnect',
                  'hooks/useWebSpeech.ts:onresult:finalAppend',
                  'Final words appended to confirmed',
                  {
                    prevLength: prev.length,
                    realWordsLength: realWords.length,
                    realWordsPreview: realWords.slice(0, 8),
                    nextLength: next.length,
                  }
                )
                return next
              })
            }
          }
          interimEmittedTokensRef.current = []
        }

        // ── Interim display (immediate — no debounce needed; speculative
        //    matching in useSpeculativeMatch handles noise suppression)
        clearInterimDebounce()
        if (interimTrim.length === 0) {
          setInterimText('')
        } else {
          setInterimText(interimTrim)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return
        listeningRef.current = false
        setError(event.error)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        setMicStream(null)
        recognitionRef.current = null
        clearInterimDebounce()
        setInterimText('')
        setIsListening(false)
      }

      recognition.onend = () => {
        if (!listeningRef.current || !recognitionRef.current) return
        try { recognitionRef.current.start() } catch { /* already started */ }
      }

      listeningRef.current = true
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        recognitionRef.current = null
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        setMicStream(null)
        setIsListening(false)
        return false
      }

      setIsListening(true)
      return true
    } catch (err: unknown) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setError(isDenied ? 'Microphone permission denied' : 'Could not start microphone')
      setMicStream(null)
      streamRef.current = null
      recognitionRef.current = null
      listeningRef.current = false
      return false
    }
  }, [settings.language, clearInterimDebounce, debugLog])

  // Cleanup on unmount
  useEffect(() => () => { stopSession() }, [stopSession])

  return {
    interimText,
    confirmedWords,
    // WebSpeech API does not expose per-word timestamps or confidence scores,
    // so enrichedWords is always empty for this provider.
    enrichedWords: [] as import('./useSpeechProvider').EnrichedWord[],
    fillerCount,
    isListening,
    error,
    micStream,
    startSession,
    stopSession,
    reset,
    // No VAD in WebSpeech — both callbacks are no-ops
    onSpeechStart: () => {},
    onSpeechEnd: () => {},
  }
}
