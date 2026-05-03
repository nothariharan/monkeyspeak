'use client'

import { useRef, useCallback, useState, useEffect, type MutableRefObject } from 'react'
import { useTestStore } from '@/store/testStore'
import { tokensRoughlyMatch } from '@/lib/wordMatch'

export interface UseWebSpeechOptions {
  /** When true, recognition still runs but no tokens are emitted (arming / pre-epoch). */
  scoringFrozenRef?: MutableRefObject<boolean>
  /** Fires once per session when any non-empty transcript appears (interim or final). */
  onFirstRecognitionActivity?: () => void
}

interface UseWebSpeechReturn {
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  micStream: MediaStream | null
  liveTranscript: string
  startStream: () => Promise<boolean>
  stopStream: () => void
  /** Call when speed epoch commits so interim prefix state matches the prompt. */
  resetInterimEmitted: () => void
}

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
    r.onstart = () => {
      window.setTimeout(done, 120)
    }
    r.onend = () => done()
    r.onerror = () => done()
    window.setTimeout(done, 2500)
    try {
      r.start()
    } catch {
      done()
    }
  })
}

/**
 * Browser Web Speech API — same surface as useDeepgram for A/B latency experiments.
 * `onFinalWords` receives tokens from one recognition final batch (ordered).
 */
export function useWebSpeech(
  onFinalWords: (spokenTokens: string[]) => void,
  options?: UseWebSpeechOptions
): UseWebSpeechReturn {
  const { micState, setMicState, settings } = useTestStore()
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  /** True while the user session should keep listening (avoids stale closure in onend). */
  const listeningRef = useRef(false)
  const onFinalWordsRef = useRef(onFinalWords)
  /** Tokens already sent via interim “stable prefix” flush; reconciled when `isFinal` arrives. */
  const interimEmittedTokensRef = useRef<string[]>([])
  const scoringFrozenRef = options?.scoringFrozenRef
  const onFirstActivityRef = useRef(options?.onFirstRecognitionActivity)
  const firstActivityFiredRef = useRef(false)

  useEffect(() => {
    onFinalWordsRef.current = onFinalWords
  }, [onFinalWords])

  useEffect(() => {
    onFirstActivityRef.current = options?.onFirstRecognitionActivity
  }, [options?.onFirstRecognitionActivity])

  const resetInterimEmitted = useCallback(() => {
    interimEmittedTokensRef.current = []
  }, [])

  const stopStream = useCallback(() => {
    listeningRef.current = false
    firstActivityFiredRef.current = false
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMicStream(null)
    setMicState('idle')
    setLiveTranscript('')
    interimEmittedTokensRef.current = []
  }, [setMicState])

  const startStream = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setMicState('error')
      return false
    }

    if (listeningRef.current && recognitionRef.current) {
      return true
    }

    try {
      setMicState('requesting')

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
      try {
        await prewarmWebSpeechRecognition(lang)
      } catch {
        // best-effort only
      }

      const recognition = new Ctor()
      recognitionRef.current = recognition
      firstActivityFiredRef.current = false
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = lang

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let hasAnyTranscript = false
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i]?.[0]?.transcript?.trim() ?? ''
          if (t.length > 0) {
            hasAnyTranscript = true
            break
          }
        }
        if (hasAnyTranscript && !firstActivityFiredRef.current) {
          firstActivityFiredRef.current = true
          onFirstActivityRef.current?.()
        }

        const frozen = scoringFrozenRef?.current ?? false

        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i]
          if (!r.isFinal) {
            interim += r[0]?.transcript ?? ''
          }
        }
        const interimTrim = interim.trim()
        setLiveTranscript(interimTrim)

        if (frozen) {
          return
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
          const pref = interimEmittedTokensRef.current
          let i = 0
          while (
            i < finalBatch.length &&
            i < pref.length &&
            tokensRoughlyMatch(finalBatch[i]!, pref[i]!)
          ) {
            i++
          }
          const suffix = finalBatch.slice(i)
          if (suffix.length > 0) {
            onFinalWordsRef.current(suffix)
          }
          interimEmittedTokensRef.current = []
        }

        // Commit complete words from interim without waiting for a pause (last token stays “live”).
        const words = interimTrim.split(/\s+/).filter(Boolean)
        const stable = words.length >= 2 ? words.slice(0, -1) : []
        const prev = interimEmittedTokensRef.current
        let prefixOk = true
        const n = Math.min(stable.length, prev.length)
        for (let j = 0; j < n; j++) {
          if (!tokensRoughlyMatch(stable[j]!, prev[j]!)) {
            prefixOk = false
            break
          }
        }
        if (!prefixOk) {
          interimEmittedTokensRef.current = []
          return
        }
        if (stable.length > prev.length) {
          const toEmit = stable.slice(prev.length)
          if (toEmit.length > 0) {
            onFinalWordsRef.current(toEmit)
          }
        }
        interimEmittedTokensRef.current = stable.slice()
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return
        listeningRef.current = false
        setMicState('error')
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        setMicStream(null)
        recognitionRef.current = null
        setLiveTranscript('')
      }

      recognition.onend = () => {
        if (!listeningRef.current || !recognitionRef.current) return
        try {
          recognitionRef.current.start()
        } catch {
          // already started
        }
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
        setMicState('error')
        return false
      }
      setMicState('active')
      return true
    } catch (err: unknown) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setMicState(isDenied ? 'denied' : 'error')
      setMicStream(null)
      streamRef.current = null
      recognitionRef.current = null
      listeningRef.current = false
      return false
    }
  }, [settings.language, setMicState, scoringFrozenRef])

  return { micState, micStream, liveTranscript, startStream, stopStream, resetInterimEmitted }
}
