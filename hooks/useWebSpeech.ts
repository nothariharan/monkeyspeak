'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useTestStore } from '@/store/testStore'
import { isFiller } from '@/lib/fillers'
import type { SpeechProvider, SessionStartResult } from './useSpeechProvider'

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
 * confirmed state.
 *  - prewarm on startSession
 *  - continuous restart on onend
 *
 * Filler detection now happens inside this hook so the interface is self-contained.
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

  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const listeningRef = useRef(false)

  /** Complete interim tokens (not the trailing partial); used to strip finals only. */
  const interimEmittedTokensRef = useRef<string[]>([])
  const previewWordsRef = useRef<string[]>([])

  const reset = useCallback(() => {
    interimEmittedTokensRef.current = []
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    setConfirmedWords([])
    setFillerCount(0)
    setError(null)
  }, [])

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
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    interimEmittedTokensRef.current = []
  }, [])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      const msg = 'Web Speech API not supported in this browser'
      setError(msg)
      return { ok: false, error: msg }
    }

    if (listeningRef.current && recognitionRef.current) return { ok: true }

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
        // Collect ALL current non-final results for interim display.
        // Scan from 0 (not event.resultIndex) because older non-final
        // results at lower indices may still exist and contain speech.
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
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
          } else {
            interimEmittedTokensRef.current = []
          }
        }

        const previewBatch = interimEmittedTokensRef.current.filter((word) => !isFiller(word))
        if (previewBatch.length === 0) {
          previewWordsRef.current = []
          setPreviewWords([])
        } else if (previewBatch.length >= previewWordsRef.current.length) {
          previewWordsRef.current = previewBatch
          setPreviewWords(previewBatch)
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
          let newFillers = 0
          const realWords: string[] = []
          for (const w of finalBatch) {
            const norm = w.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
            if (!norm) continue
            if (isFiller(norm)) {
              newFillers++
            } else {
              realWords.push(norm)
            }
          }
          if (newFillers > 0) setFillerCount((c) => c + newFillers)
          if (realWords.length > 0) {
            setConfirmedWords((prev) => [...prev, ...realWords])
          }
          previewWordsRef.current = []
          setPreviewWords([])
          interimEmittedTokensRef.current = []
        }

        // ── Interim display (immediate)
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
        setInterimText('')
        previewWordsRef.current = []
        setPreviewWords([])
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
        const msg = 'Could not start speech recognition'
        setError(msg)
        return { ok: false, error: msg }
      }

      setIsListening(true)
      return { ok: true }
    } catch (err: unknown) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      const msg = isDenied ? 'Microphone permission denied' : 'Could not start microphone'
      setError(msg)
      setMicStream(null)
      streamRef.current = null
      recognitionRef.current = null
      listeningRef.current = false
      previewWordsRef.current = []
      setPreviewWords([])
      return { ok: false, error: msg }
    }
  }, [settings.language])

  // Cleanup on unmount
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
