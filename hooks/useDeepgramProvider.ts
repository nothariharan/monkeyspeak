'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { LiveClient } from '@deepgram/sdk'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import { useTestStore } from '@/store/testStore'
import type { SpeechProvider, EnrichedWord } from './useSpeechProvider'

const TOKEN_SKEW_MS = 1500
const TOKEN_REFRESH_IF_TTL_UNDER_MS = 10_000

let cachedToken: string | null = null
let cacheExpiresAt = 0

async function fetchDeepgramToken(): Promise<string> {
  const now = Date.now()
  const cacheOk = !!(cachedToken && cacheExpiresAt > now + TOKEN_SKEW_MS)
  if (cacheOk) {
    const ttlRemainingMs = cacheExpiresAt - now
    if (ttlRemainingMs < TOKEN_REFRESH_IF_TTL_UNDER_MS) {
      cachedToken = null
      cacheExpiresAt = 0
    } else {
      return cachedToken as string
    }
  }

  const res = await fetch('/api/deepgram/token', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to fetch Deepgram token')
  const body = (await res.json()) as { token: string; ttlSeconds?: number }
  const ttlMs = Math.max(8_000, ((body.ttlSeconds ?? 28) * 1000) - TOKEN_SKEW_MS)
  cachedToken = body.token
  cacheExpiresAt = now + ttlMs
  return cachedToken
}

export async function prefetchDeepgramKey(): Promise<void> {
  await fetchDeepgramToken().catch(() => {})
}

/** Low-latency streaming defaults for nova-3 (SDK typings may omit some WS flags). */
function buildDgLiveOpts(language: string) {
  return {
    model: 'nova-3' as const,
    language,
    channels: 1,
    smart_format: true,
    interim_results: true,
    filler_words: true,
    vad_events: true,
    // 200 ms gives Deepgram enough time to avoid cutting multi-syllable words
    // mid-utterance. The previous 10 ms was too aggressive.
    endpointing: 200,
    // Force a final transcript after 200 ms of silence (matches endpointing).
    utterance_end_ms: 200,
    no_delay: true,
    encoding: 'linear16' as const,
    sample_rate: 16000,
  }
}

export function useDeepgramProvider(): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [enrichedWords, setEnrichedWords]   = useState<EnrichedWord[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const liveRef     = useRef<LiveClient | null>(null)
  const prewarmRef  = useRef<LiveClient | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const workletRef  = useRef<AudioWorkletNode | null>(null)
  const contextRef  = useRef<AudioContext | null>(null)
  const activeRef   = useRef(false)
  const armedRef    = useRef(false)

  // ── Pre-warm the WebSocket on mount to absorb the TLS handshake ────────────
  // The pre-warmed connection is picked up by _openConnection if still open,
  // eliminating the handshake cost from the critical path when the user
  // clicks Start. Token is also pre-fetched here.
  useEffect(() => {
    let cancelled = false

    async function prewarm() {
      try {
        const token = await fetchDeepgramToken()
        if (cancelled) return

        const language = useTestStore.getState().settings.language ?? 'en-US'
        const deepgram = createClient(token)
        const live = deepgram.listen.live(
          buildDgLiveOpts(language) as Parameters<typeof deepgram.listen.live>[0]
        )
        prewarmRef.current = live

        live.on(LiveTranscriptionEvents.Error, () => {
          if (prewarmRef.current === live) prewarmRef.current = null
        })
        live.on(LiveTranscriptionEvents.Close, () => {
          if (prewarmRef.current === live) prewarmRef.current = null
        })
      } catch {
        // Pre-warm is best-effort; _openConnection falls back to on-demand.
      }
    }

    void prewarm()

    return () => {
      cancelled = true
      if (prewarmRef.current) {
        try { prewarmRef.current.requestClose() } catch { /* ignore */ }
        prewarmRef.current = null
      }
    }
  }, [])

  const _teardown = useCallback(() => {
    activeRef.current = false

    if (workletRef.current) {
      try { workletRef.current.disconnect(); workletRef.current.port.close() } catch { /* ignore */ }
      workletRef.current = null
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {})
      contextRef.current = null
    }
    if (liveRef.current) {
      try { liveRef.current.requestClose() } catch { /* ignore */ }
      liveRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMicStream(null)
    setIsListening(false)
    setInterimText('')
  }, [])

  const reset = useCallback(() => {
    setInterimText('')
    setConfirmedWords([])
    setEnrichedWords([])
    setFillerCount(0)
    setError(null)
  }, [])

  const stopSession = useCallback(() => {
    armedRef.current = false
    _teardown()
  }, [_teardown])

  // ── Audio worklet setup (shared by pre-warmed and fresh connections) ────────
  const _setupAudioWorklet = useCallback(async (live: LiveClient, stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx({ sampleRate: 16000 })
      contextRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      await ctx.audioWorklet.addModule('/pcm-processor.worklet.js')

      const source = ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor')
      workletRef.current = worklet

      worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        if (live.getReadyState() !== WebSocket.OPEN) return
        const input = ev.data
        if (!input?.length) return
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        live.send(pcm16.buffer)
      }

      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(worklet)
      worklet.connect(mute)
      mute.connect(ctx.destination)

      if (activeRef.current) setIsListening(true)
    } catch {
      setError('Could not start audio capture')
      _teardown()
    }
  }, [_teardown])

  const _openConnection = useCallback(async (): Promise<boolean> => {
    setError(null)

    let token: string
    try {
      token = await fetchDeepgramToken()
    } catch {
      setError('Could not get Deepgram auth token')
      return false
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      })
    } catch (err: unknown) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setError(isDenied ? 'Microphone permission denied' : 'Could not start microphone')
      return false
    }
    streamRef.current = stream
    setMicStream(stream)

    // Use the pre-warmed WebSocket if it is already open; otherwise open fresh.
    // This eliminates the TLS handshake from the critical path.
    let live: LiveClient
    const prewarmed =
      prewarmRef.current?.getReadyState() === WebSocket.OPEN
        ? prewarmRef.current
        : null

    if (prewarmed) {
      live = prewarmed
      prewarmRef.current = null
      liveRef.current = live
    } else {
      const deepgram = createClient(token)
      const language = useTestStore.getState().settings.language ?? 'en-US'
      const dgOpts = buildDgLiveOpts(language)
      live = deepgram.listen.live(dgOpts as Parameters<typeof deepgram.listen.live>[0])
      liveRef.current = live
    }

    // ── Transcript handler ─────────────────────────────────────────────────
    live.on(LiveTranscriptionEvents.Transcript, (data) => {
      if (!activeRef.current) return

      const alt = data.channel?.alternatives?.[0]
      if (!alt) return

      const transcript = (alt.transcript ?? '').trim()
      if (!transcript) return

      if (!data.is_final) {
        setInterimText(transcript)
        return
      }

      setInterimText('')

      // Extract per-word timing and confidence from Deepgram's word objects.
      // These are stored in enrichedWords (parallel to confirmedWords) for use
      // by the aligner in Phase 2 per-word WPM calculations.
      const wordObjs = (alt.words ?? []) as Array<{
        word: string
        start: number
        end: number
        confidence: number
        punctuated_word?: string
      }>

      let newFillers = 0
      const realWords: string[] = []
      const realEnriched: EnrichedWord[] = []

      if (wordObjs.length > 0) {
        for (const w of wordObjs) {
          if (isFiller(w.word)) {
            newFillers++
          } else {
            realWords.push(w.word)
            realEnriched.push({
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
            })
          }
        }
      } else {
        // Fallback when Deepgram doesn't emit word-level objects.
        for (const w of transcript.split(/\s+/).filter(Boolean)) {
          if (isFiller(w)) {
            newFillers++
          } else {
            realWords.push(w)
            realEnriched.push({ word: w })
          }
        }
      }

      if (newFillers > 0) setFillerCount((c) => c + newFillers)
      if (realWords.length > 0) {
        setConfirmedWords((prev) => [...prev, ...realWords])
        setEnrichedWords((prev) => [...prev, ...realEnriched])
      }
    })

    live.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('[Deepgram] error:', err)
      setError('Deepgram connection error')
      _teardown()
    })

    live.on(LiveTranscriptionEvents.Close, () => {
      if (activeRef.current || armedRef.current) {
        activeRef.current = false
        armedRef.current = false
        setIsListening(false)
      }
    })

    // Set up AudioWorklet — immediately if WS is already open (pre-warmed path),
    // otherwise wait for the Open event.
    if (prewarmed) {
      void _setupAudioWorklet(live, stream)
    } else {
      live.on(LiveTranscriptionEvents.Open, () => {
        void _setupAudioWorklet(live, stream)
      })
    }

    return true
  }, [_teardown, _setupAudioWorklet])

  const armSession = useCallback(async (): Promise<boolean> => {
    if (armedRef.current || activeRef.current) return true
    armedRef.current = true
    const ok = await _openConnection()
    if (!ok) armedRef.current = false
    return ok
  }, [_openConnection])

  const startSession = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true

    if (armedRef.current && liveRef.current) {
      activeRef.current = true
      if (liveRef.current.getReadyState() === WebSocket.OPEN) {
        setIsListening(true)
      }
      return true
    }

    const ok = await _openConnection()
    if (!ok) return false
    activeRef.current = true
    if (liveRef.current?.getReadyState() === WebSocket.OPEN) {
      setIsListening(true)
    }
    return true
  }, [_openConnection])

  useEffect(() => () => { _teardown() }, [_teardown])

  return {
    interimText,
    confirmedWords,
    enrichedWords,
    fillerCount,
    isListening,
    error,
    micStream,
    armSession,
    startSession,
    stopSession,
    reset,
  }
}
