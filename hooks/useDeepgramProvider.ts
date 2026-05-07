'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import type { SpeechProvider } from './useSpeechProvider'

// ─── Token caching ────────────────────────────────────────────────────────────

const TOKEN_SKEW_MS = 1500

let cachedKey: string | null = null
let cacheExpiresAt = 0

async function fetchDeepgramKey(): Promise<string> {
  const now = Date.now()
  if (cachedKey && cacheExpiresAt > now + TOKEN_SKEW_MS) return cachedKey

  const res = await fetch('/api/deepgram/token')
  if (!res.ok) throw new Error('Failed to fetch Deepgram token')
  const body = (await res.json()) as { key: string; ttlSeconds?: number }
  const ttlMs = Math.max(8_000, ((body.ttlSeconds ?? 28) * 1000) - TOKEN_SKEW_MS)
  cachedKey = body.key
  cacheExpiresAt = now + ttlMs
  return cachedKey
}

/** Call when the user selects Deepgram so the token is warm by test-start time. */
export async function prefetchDeepgramKey(): Promise<void> {
  await fetchDeepgramKey().catch(() => {})
}

// ─── Deepgram connection config (from deepgram.md) ───────────────────────────

const DG_PARAMS = new URLSearchParams({
  model:            'nova-3',
  language:         'en-US',
  channels:         '1',
  smart_format:     'true',
  interim_results:  'true',
  utterance_end_ms: '1000',
  vad_events:       'true',
  endpointing:      '300',
  filler_words:     'true',
  encoding:         'linear16',
  sample_rate:      '16000',
  disfluencies:     'true',
})

const DG_WS_URL = `wss://api.deepgram.com/v1/listen?${DG_PARAMS.toString()}`

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Deepgram Nova-3 streaming STT shaped to the SpeechProvider interface.
 *
 * Architecture:
 *  - ScriptProcessorNode (512 sample buffer = ~32ms at 16kHz) → Int16 PCM → WebSocket
 *  - is_final: false  → setInterimText immediately (no debounce needed; Deepgram
 *                        rate-limits its own interim emissions)
 *  - is_final: true   → accumulate confirmedWords / fillerCount, clear interimText
 *  - Token pre-fetched on mount; WebSocket only opened inside startSession()
 */
export function useDeepgramProvider(): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const wsRef        = useRef<WebSocket | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const contextRef   = useRef<AudioContext | null>(null)
  const activeRef    = useRef(false)

  // Pre-fetch token on mount so it's warm when the user starts
  useEffect(() => {
    prefetchDeepgramKey()
  }, [])

  const _teardown = useCallback(() => {
    activeRef.current = false

    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch { /* ignore */ }
      processorRef.current = null
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {})
      contextRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
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
    setFillerCount(0)
    setError(null)
  }, [])

  const stopSession = useCallback(() => {
    _teardown()
  }, [_teardown])

  const startSession = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true

    setError(null)

    // 1. Fetch token (usually already cached from mount prefetch)
    let key: string
    try {
      key = await fetchDeepgramKey()
    } catch {
      setError('Could not get Deepgram auth token')
      return false
    }

    // 2. Acquire microphone
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

    // 3. Open Deepgram WebSocket
    const ws = new WebSocket(DG_WS_URL, ['token', key])
    wsRef.current = ws

    ws.onopen = () => {
      // 4. AudioContext MUST be created after user gesture — do it here, inside ws.onopen
      //    which is triggered synchronously from the user's click chain.
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx({ sampleRate: 16000 })
      contextRef.current = ctx
      if (ctx.state === 'suspended') void ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      // 512 samples at 16kHz ≈ 32ms per chunk — smallest valid size, lowest capture latency
      const processor = ctx.createScriptProcessor(512, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        ws.send(pcm16.buffer)
      }

      source.connect(processor)
      // Mute the processor output to prevent mic bleed through speakers
      const mute = ctx.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(ctx.destination)

      activeRef.current = true
      setIsListening(true)
    }

    ws.onmessage = (event) => {
      if (!activeRef.current) return
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string
          is_final?: boolean
          speech_final?: boolean
          channel?: {
            alternatives?: Array<{
              transcript?: string
              words?: Array<{ word: string }>
            }>
          }
        }

        // Only process transcription results
        if (data.type != null && data.type !== 'Results') return

        const alt = data.channel?.alternatives?.[0]
        if (!alt) return

        const transcript = (alt.transcript ?? '').trim()
        if (!transcript) return

        if (!data.is_final) {
          // Interim — show immediately, no debounce (Deepgram already rate-limits these)
          setInterimText(transcript)
          return
        }

        // Final — commit words and detect fillers
        setInterimText('')

        const wordObjs = alt.words ?? []
        const tokens =
          wordObjs.length > 0
            ? wordObjs.map((w) => w.word).filter(Boolean)
            : transcript.split(/\s+/).filter(Boolean)

        let newFillers = 0
        const realWords: string[] = []
        for (const w of tokens) {
          if (isFiller(w)) { newFillers++ } else { realWords.push(w) }
        }
        if (newFillers > 0) setFillerCount((c) => c + newFillers)
        if (realWords.length > 0) setConfirmedWords((prev) => [...prev, ...realWords])
      } catch {
        // Ignore malformed JSON
      }
    }

    ws.onerror = () => {
      setError('Deepgram connection error')
      _teardown()
    }

    ws.onclose = () => {
      if (activeRef.current) {
        // Unexpected close while session should still be running
        activeRef.current = false
        setIsListening(false)
      }
    }

    return true
  }, [_teardown])

  // Cleanup on unmount
  useEffect(() => () => { _teardown() }, [_teardown])

  return {
    interimText,
    confirmedWords,
    fillerCount,
    isListening,
    error,
    micStream,
    startSession,
    stopSession,
    reset,
  }
}
