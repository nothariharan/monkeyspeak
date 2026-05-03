'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useTestStore } from '@/store/testStore'
import { tokensRoughlyMatch } from '@/lib/wordMatch'

interface UseWebSpeechReturn {
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  micStream: MediaStream | null
  liveTranscript: string
  startStream: () => Promise<boolean>
  stopStream: () => void
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Browser Web Speech API — same surface as useDeepgram for A/B latency experiments.
 * `onFinalWords` receives tokens from one recognition final batch (ordered).
 */
export function useWebSpeech(onFinalWords: (spokenTokens: string[]) => void): UseWebSpeechReturn {
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

  useEffect(() => {
    onFinalWordsRef.current = onFinalWords
  }, [onFinalWords])

  const stopStream = useCallback(() => {
    listeningRef.current = false
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

      const recognition = new Ctor()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = settings.language ?? 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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

        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i]
          if (!r.isFinal) {
            interim += r[0]?.transcript ?? ''
          }
        }
        const interimTrim = interim.trim()
        setLiveTranscript(interimTrim)

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
  }, [settings.language, setMicState])

  return { micState, micStream, liveTranscript, startStream, stopStream }
}
