'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTestStore } from '@/store/testStore'

interface UseDeepgramReturn {
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  micStream: MediaStream | null
  liveTranscript: string
  startStream: () => Promise<boolean>
  stopStream: () => void
}

/** Avoid using a key within this many ms of server expiry */
const TOKEN_SKEW_MS = 1500

let tokenKeyCache: string | null = null
let tokenExpiresAt = 0

export async function prefetchDeepgramKey(): Promise<void> {
  await loadDeepgramKey().catch(() => {})
}

async function loadDeepgramKey(): Promise<string> {
  const now = Date.now()
  if (tokenKeyCache && tokenExpiresAt > now + TOKEN_SKEW_MS) {
    return tokenKeyCache
  }
  const tokenRes = await fetch('/api/deepgram/token')
  if (!tokenRes.ok) throw new Error('Failed to get Deepgram token')
  const body = (await tokenRes.json()) as { key: string; ttlSeconds?: number }
  const ttlSec = typeof body.ttlSeconds === 'number' ? body.ttlSeconds : 28
  const ttlMs = Math.max(8_000, ttlSec * 1000 - TOKEN_SKEW_MS)
  tokenKeyCache = body.key
  tokenExpiresAt = now + ttlMs
  return body.key
}

/**
 * Manages the Deepgram WebSocket connection and microphone stream.
 * `onFinalWords` receives all tokens from one `is_final` result in order — align to prompt in the parent.
 */
export function useDeepgram(onFinalWords: (spokenTokens: string[]) => void): UseDeepgramReturn {
  const { micState, setMicState, settings } = useTestStore()
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const contextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    void prefetchDeepgramKey()
  }, [])

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (contextRef.current) {
      contextRef.current.close()
      contextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setMicStream(null)
    setMicState('idle')
    setLiveTranscript('')
  }, [setMicState])

  const startStream = useCallback(async () => {
    try {
      setMicState('requesting')

      // Key is usually warm from prefetchDeepgramKey() on mount — still await before mic
      // so we never leave a granted mic open if token fetch fails.
      const key = await loadDeepgramKey()

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
      setMicState('active')

      const lang = settings.language ?? 'en-US'
      const params = new URLSearchParams({
        // nova-3: lower latency + better streaming than nova-2 (Deepgram streaming STT)
        model: 'nova-3',
        language: lang,
        channels: '1',
        smart_format: 'true',
        disfluencies: 'true',
        // Keep uh/um in transcript for filler detection (otherwise often stripped)
        filler_words: 'true',
        interim_results: 'true',
        utterance_end_ms: '1000',
        vad_events: 'true',
        // Natural pause boundary for is_final; avoids default extremes (see Deepgram endpointing docs)
        endpointing: '300',
        encoding: 'linear16',
        sample_rate: '16000',
      })
      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

      const ws = new WebSocket(wsUrl, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx({ sampleRate: 16000 })
        contextRef.current = ctx
        if (ctx.state === 'suspended') void ctx.resume()

        const source = ctx.createMediaStreamSource(stream)
        // 1024 samples @ 16kHz ≈ 64ms frames → audio reaches Deepgram sooner than 2048 (~128ms)
        const processor = ctx.createScriptProcessor(1024, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const input = e.inputBuffer.getChannelData(0)
          const int16 = new Int16Array(input.length)
          for (let i = 0; i < input.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)))
          }
          ws.send(int16.buffer)
        }

        source.connect(processor)
        processor.connect(ctx.destination)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type?: string
            is_final?: boolean
            channel?: { alternatives?: Array<{ transcript?: string; words?: Array<{ word: string }> }> }
          }

          if (data.type != null && data.type !== 'Results') return

          const alt = data.channel?.alternatives?.[0]
          if (!alt) return

          const transcript = (alt.transcript ?? '').trim()

          if (!data.is_final) {
            setLiveTranscript(transcript)
            return
          }

          setLiveTranscript('')

          const words = alt.words ?? []
          let tokens = words.map((w) => w.word).filter((w) => w && w.trim())
          if (tokens.length === 0 && transcript) {
            tokens = transcript.split(/\s+/).filter(Boolean)
          }
          if (tokens.length > 0) {
            onFinalWords(tokens)
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      ws.onerror = () => {
        setMicState('error')
        stopStream()
      }

      ws.onclose = () => {
        // Normal closure
      }
      return true
    } catch (err: unknown) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setMicState(isDenied ? 'denied' : 'error')
      setMicStream(null)
      return false
    }
  }, [settings.language, setMicState, onFinalWords, stopStream])

  return { micState, micStream, liveTranscript, startStream, stopStream }
}
