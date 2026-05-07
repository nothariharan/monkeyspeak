'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import type { SpeechProvider } from './useSpeechProvider'

// ─── Token caching ────────────────────────────────────────────────────────────

const TOKEN_SKEW_MS = 1500

let cachedToken: string | null = null
let cacheExpiresAt = 0

async function fetchDeepgramToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cacheExpiresAt > now + TOKEN_SKEW_MS) return cachedToken

  const res = await fetch('/api/deepgram/token', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to fetch Deepgram token')
  const body = (await res.json()) as { token: string; ttlSeconds?: number }
  const ttlMs = Math.max(8_000, ((body.ttlSeconds ?? 28) * 1000) - TOKEN_SKEW_MS)
  cachedToken = body.token
  cacheExpiresAt = now + ttlMs
  return cachedToken
}

/** Call when the user selects Deepgram so the token is warm by test-start time. */
export async function prefetchDeepgramKey(): Promise<void> {
  await fetchDeepgramToken().catch(() => {})
}

// ─── Deepgram connection config ───────────────────────────────────────────────
//
// Browser WebSocket API cannot set HTTP headers. Deepgram's browser-compatible
// auth method is to pass the token as `access_token` in the URL query string.
// The @deepgram/sdk LiveClient hardcodes ["token", key] sub-protocols in browser
// context (AbstractLiveClient.ts:144) which Deepgram rejects with HTTP 400.
// We use raw WebSocket + access_token URL param instead.
//
// Params: deepgram.md §2.2 (only officially documented parameters)

function buildDeepgramUrl(token: string): string {
  const params = new URLSearchParams({
    access_token:     token,           // browser auth — header auth not possible in WS
    model:            'nova-3',
    language:         'en-US',
    channels:         '1',
    smart_format:     'true',
    interim_results:  'true',
    utterance_end_ms: '300',
    vad_events:       'true',
    endpointing:      '100',
    filler_words:     'true',
    encoding:         'linear16',
    sample_rate:      '16000',
  })
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Deepgram Nova-3 streaming STT shaped to the SpeechProvider interface.
 *
 * Auth: access_token URL query param (the only method that works in browsers —
 * the SDK's sub-protocol approach and header-based auth are both rejected with 400).
 *
 * Architecture:
 *  - armSession()   → opens mic + WebSocket during countdown (warm path)
 *  - startSession() → if armed, flips activeRef → true (zero WS latency)
 *                     otherwise full handshake (cold path)
 *  - ScriptProcessorNode 512 samples ≈ 32ms at 16kHz → Int16 PCM → ws.send()
 *  - is_final: false → setInterimText immediately
 *  - is_final: true  → accumulate confirmedWords / fillerCount, clear interimText
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
  const armedRef     = useRef(false)

  // Pre-fetch token on mount so it's warm when the user starts
  useEffect(() => {
    prefetchDeepgramKey()
  }, [])

  const _teardown = useCallback(() => {
    activeRef.current = false
    armedRef.current = false

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

  /**
   * _openConnection — shared by armSession() and startSession().
   * Opens the mic + WebSocket. Does NOT set activeRef (caller decides).
   */
  const _openConnection = useCallback(async (): Promise<boolean> => {
    setError(null)

    // 1. Fetch token (usually cached from mount prefetch)
    let token: string
    try {
      token = await fetchDeepgramToken()
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

    // 3. Open raw WebSocket with access_token in URL.
    //    Browser WebSocket API cannot set HTTP headers, so sub-protocol and
    //    Authorization header auth don't work. access_token URL param does.
    const ws = new WebSocket(buildDeepgramUrl(token))
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      // AudioContext MUST be created after user gesture
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx({ sampleRate: 16000 })
      contextRef.current = ctx
      if (ctx.state === 'suspended') void ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(512, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        ws.send(pcm16.buffer)
      }

      source.connect(processor)
      const mute = ctx.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(ctx.destination)

      if (activeRef.current) setIsListening(true)
    }

    ws.onmessage = (event) => {
      if (!activeRef.current) return
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string
          is_final?: boolean
          channel?: {
            alternatives?: Array<{
              transcript?: string
              words?: Array<{ word: string }>
            }>
          }
        }

        if (data.type != null && data.type !== 'Results') return

        const alt = data.channel?.alternatives?.[0]
        if (!alt) return

        const transcript = (alt.transcript ?? '').trim()
        if (!transcript) return

        if (!data.is_final) {
          setInterimText(transcript)
          return
        }

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

    ws.onerror = (e) => {
      console.error('[Deepgram] WebSocket error:', e)
      setError('Deepgram connection error')
      _teardown()
    }

    ws.onclose = (e) => {
      console.log('[Deepgram] WebSocket closed. Code:', e.code, 'Reason:', e.reason)
      if (activeRef.current || armedRef.current) {
        activeRef.current = false
        armedRef.current = false
        setIsListening(false)
      }
    }

    return true
  }, [_teardown])

  const armSession = useCallback(async (): Promise<boolean> => {
    if (armedRef.current || activeRef.current) return true
    armedRef.current = true
    const ok = await _openConnection()
    if (!ok) armedRef.current = false
    return ok
  }, [_openConnection])

  const startSession = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true

    if (armedRef.current && wsRef.current) {
      activeRef.current = true
      if (wsRef.current.readyState === WebSocket.OPEN) {
        setIsListening(true)
      }
      return true
    }

    const ok = await _openConnection()
    if (!ok) return false
    activeRef.current = true
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsListening(true)
    }
    return true
  }, [_openConnection])

  useEffect(() => () => { _teardown() }, [_teardown])

  return {
    interimText,
    confirmedWords,
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
