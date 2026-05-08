'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { LiveClient } from '@deepgram/sdk'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import { useTestStore } from '@/store/testStore'
import type { SpeechProvider } from './useSpeechProvider'

// #region agent log
function dbgAgent(entry: {
  runId: string
  hypothesisId: string
  location: string
  message: string
  data?: Record<string, unknown>
}): void {
  const payload = { sessionId: '1ddc33', ...entry, timestamp: Date.now() }
  if (typeof window !== 'undefined') {
    // Mirror to console so we still get runtime evidence if file logging is unavailable.
    // #region agent log
    console.info('[agent-debug]', payload)
    // #endregion
  }
  void fetch('/api/debug-agent-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1ddc33' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const text = await res.text().catch(() => '')
      const row = {
        ...payload,
        _dbgApiStatus: res.status,
        _dbgApiBody: text.slice(0, 400),
      }
      if (typeof window !== 'undefined') {
        type W = Window & { __MS_AGENT_LOG?: unknown[] }
        const w = window as W
        w.__MS_AGENT_LOG = [...(w.__MS_AGENT_LOG ?? []), row].slice(-40)
      }
    })
    .catch(() => {})
  fetch('http://127.0.0.1:7324/ingest/fd637405-eeb4-445b-93bd-a5bf3520bc5e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1ddc33' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
// #endregion

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

export async function prefetchDeepgramKey(): Promise<void> {
  await fetchDeepgramToken().catch(() => {})
}

// ─── Deepgram connection config ───────────────────────────────────────────────

// Minimal handshake config for isolation debugging. Add optional params back only after stable connect.
function buildDgLiveOpts(language: string) {
  return {
    model:              'nova-3' as const,
    language,
    channels:           1,
    smart_format:       true,
    interim_results:    true,
    encoding:           'linear16' as const,
    sample_rate:        16000,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeepgramProvider(): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const liveRef      = useRef<LiveClient | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const contextRef   = useRef<AudioContext | null>(null)
  const activeRef    = useRef(false)
  const armedRef     = useRef(false)

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
    if (liveRef.current) {
      try {
        liveRef.current.requestClose()
      } catch { /* ignore */ }
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
    setFillerCount(0)
    setError(null)
  }, [])

  const stopSession = useCallback(() => {
    armedRef.current = false
    _teardown()
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

    const deepgram = createClient(token)
    const language =
      useTestStore.getState().settings.language ?? 'en-US'
    const dgOpts = buildDgLiveOpts(language)
    // #region agent log
    dbgAgent({
      runId: 'verify6',
      hypothesisId: 'H0',
      location: 'useDeepgramProvider.ts:_openConnection',
      message: 'deepgram listen.live() invoked',
      data: {
        configSummary: {
          language: dgOpts.language,
          model: dgOpts.model,
          smart_format: dgOpts.smart_format,
          endpointing: 'omitted',
          utterance_end_ms: 'omitted',
          filler_words: 'omitted',
        },
      },
    })
    // #endregion
    const live = deepgram.listen.live(dgOpts)
    liveRef.current = live

    live.on(LiveTranscriptionEvents.Open, () => {
      // #region agent log
      dbgAgent({
        runId: 'verify6',
        hypothesisId: 'H-ok',
        location: 'useDeepgramProvider.ts:Open',
        message: 'deepgram ws open',
        data: {},
      })
      // #endregion
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
        if (live.getReadyState() !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        live.send(pcm16.buffer)
      }

      source.connect(processor)
      const mute = ctx.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(ctx.destination)

      if (activeRef.current) setIsListening(true)
    })

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

      const wordObjs: Array<{ word: string }> = alt.words ?? []
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
    })

    live.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('[Deepgram] error:', err)
      // #region agent log
      const e = err as unknown
      let errName: string | undefined
      let errMessage: string | undefined
      if (e && typeof e === 'object') {
        if ('type' in e && typeof (e as { type?: string }).type === 'string') {
          errName = (e as { type: string }).type
        }
        if ('message' in e && typeof (e as { message?: string }).message === 'string') {
          errMessage = (e as { message: string }).message
        }
      }
      dbgAgent({
        runId: 'verify6',
        hypothesisId: 'H5',
        location: 'useDeepgramProvider.ts:Error',
        message: 'deepgram ws error event',
        data: { errName, errMessage, ctor: e?.constructor?.name },
      })
      // #endregion
      setError('Deepgram connection error')
      _teardown()
    })

    live.on(LiveTranscriptionEvents.Close, (ev: unknown) => {
      // #region agent log
      const ce = ev as CloseEvent
      dbgAgent({
        runId: 'verify6',
        hypothesisId: 'H1-H4',
        location: 'useDeepgramProvider.ts:Close',
        message: 'deepgram ws close',
        data: {
          code: typeof ce?.code === 'number' ? ce.code : null,
          reason: typeof ce?.reason === 'string' ? ce.reason.slice(0, 500) : null,
          wasClean: typeof ce?.wasClean === 'boolean' ? ce.wasClean : null,
        },
      })
      // #endregion
      if (activeRef.current || armedRef.current) {
        activeRef.current = false
        armedRef.current = false
        setIsListening(false)
      }
    })

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
