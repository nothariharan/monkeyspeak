'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import type { LiveClient } from '@deepgram/sdk'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import { useTestStore } from '@/store/testStore'
import type { SpeechProvider, EnrichedWord } from './useSpeechProvider'

function dgErrData(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { name: err.name, message: err.message }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const msg = o.message ?? o.error ?? o.reason
    return {
      keys: Object.keys(o),
      message: typeof msg === 'string' ? msg : JSON.stringify(msg),
    }
  }
  return { raw: String(err) }
}

function dbgDeepgram(payload: {
  hypothesisId: string
  location: string
  message: string
  data: Record<string, unknown>
  runId?: string
}) {
  // #region agent log
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: '08c9af',
      runId: payload.runId ?? 'post-fix',
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {})
  // #endregion
}

/** Dev-only: survives Cursor/workspace log desync — inspect via `localStorage.getItem(key)` */
function persistDevDeepgramDebug(storageKey: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), ...data }))
  } catch {
    /* private mode / quota */
  }
}

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
  const issuedViaHeader = res.headers.get('X-Debug-Token-Issued-Via')
  dbgDeepgram({
    hypothesisId: 'H_net_token_http',
    location: 'hooks/useDeepgramProvider.ts:fetchDeepgramToken',
    message: 'token_fetch_response',
    data: {
      issuedViaHeader,
      status: res.status,
      /** Same-origin fetch can read this dev-only header from our route */
      hasHeader: issuedViaHeader != null && issuedViaHeader.length > 0,
    },
    runId: 'dg-token-net',
  })
  if (!res.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[MonkeySpeak][Deepgram token] HTTP error', {
        status: res.status,
        headerVia: issuedViaHeader,
      })
      persistDevDeepgramDebug('ms:lastDeepgramTokenDebug', {
        ok: false,
        status: res.status,
        headerVia: issuedViaHeader,
      })
    }
    throw new Error('Failed to fetch Deepgram token')
  }
  const body = (await res.json()) as {
    token: string
    ttlSeconds?: number
    _debugIssuedVia?: string
  }
  if (process.env.NODE_ENV !== 'production') {
    console.info('[MonkeySpeak][Deepgram token]', {
      headerVia: issuedViaHeader,
      bodyVia: body._debugIssuedVia ?? '(missing — old server bundle or prod build)',
      status: res.status,
    })
    persistDevDeepgramDebug('ms:lastDeepgramTokenDebug', {
      ok: true,
      status: res.status,
      headerVia: issuedViaHeader,
      bodyVia: body._debugIssuedVia ?? null,
    })
  }
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

  const liveRef           = useRef<LiveClient | null>(null)
  const prewarmRef        = useRef<LiveClient | null>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const workletRef        = useRef<AudioWorkletNode | null>(null)
  const contextRef        = useRef<AudioContext | null>(null)
  const vadWorkerRef      = useRef<Worker | null>(null)
  const activeRef         = useRef(false)
  const armedRef          = useRef(false)
  const onSpeechStartRef  = useRef<((ts: number) => void) | null>(null)
  const onSpeechEndRef    = useRef<((ts: number) => void) | null>(null)

  // ── Pre-warm the WebSocket on mount to absorb the TLS handshake ────────────
  useEffect(() => {
    let cancelled = false

    async function prewarm() {
      try {
        const token = await fetchDeepgramToken()
        if (cancelled) return

        // #region agent log
        const _pwIsJwt = token.startsWith('eyJ') && token.split('.').length === 3
        // #endregion
        dbgDeepgram({
          hypothesisId: 'H2_token_client_ok',
          location: 'useDeepgramProvider.ts:prewarm',
          message: 'token_fetched',
          data: { tokenLen: token.length, prefix: token.slice(0, 6), isJwt: _pwIsJwt },
          runId: 'post-fix',
        })

        const language = useTestStore.getState().settings.language ?? 'en-US'
        const deepgram = createClient(token)
        const live = deepgram.listen.live(
          buildDgLiveOpts(language) as Parameters<typeof deepgram.listen.live>[0]
        )
        prewarmRef.current = live

        live.on(LiveTranscriptionEvents.Open, () => {
          dbgDeepgram({
            hypothesisId: 'H4_prewarm_open',
            location: 'useDeepgramProvider.ts:prewarm',
            message: 'LiveTranscriptionEvents.Open',
            data: { readyState: live.getReadyState() },
          })
        })
        live.on(LiveTranscriptionEvents.Error, (err) => {
          const errData = dgErrData(err)
          dbgDeepgram({
            hypothesisId: 'H5_prewarm_err',
            location: 'useDeepgramProvider.ts:prewarm',
            message: 'LiveTranscriptionEvents.Error',
            data: errData,
          })
          persistDevDeepgramDebug('ms:lastDeepgramWsError', { ...errData, scope: 'prewarm' })
          if (prewarmRef.current === live) prewarmRef.current = null
        })
        live.on(LiveTranscriptionEvents.Close, (closeEvent: unknown) => {
          // #region agent log
          const ce = closeEvent as { code?: number; reason?: string; wasClean?: boolean } | null
          console.warn('[DG:prewarm:close]', { code: ce?.code, reason: ce?.reason, wasClean: ce?.wasClean })
          // #endregion
          dbgDeepgram({
            hypothesisId: 'H6_prewarm_close',
            location: 'useDeepgramProvider.ts:prewarm',
            message: 'LiveTranscriptionEvents.Close',
            data: { code: ce?.code, reason: ce?.reason, wasClean: ce?.wasClean, readyState: live.getReadyState() },
          })
          if (prewarmRef.current === live) prewarmRef.current = null
        })
      } catch (e) {
        dbgDeepgram({
          hypothesisId: 'H2_token_client_fail',
          location: 'useDeepgramProvider.ts:prewarm',
          message: 'prewarm_catch',
          data: { err: String(e) },
        })
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

    if (vadWorkerRef.current) {
      try {
        vadWorkerRef.current.postMessage({ type: 'reset' })
        vadWorkerRef.current.terminate()
      } catch { /* ignore */ }
      vadWorkerRef.current = null
    }
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

      // ── Spawn VAD Worker ────────────────────────────────────────────────
      const vadWorker = new Worker('/vad-worker.js')
      vadWorkerRef.current = vadWorker

      vadWorker.postMessage({ type: 'init' })

      // Worklet → VAD Worker: forward raw Float32 samples (already 16kHz)
      worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        if (!ev.data?.length) return
        if (!activeRef.current) return
        // Transfer ownership to avoid copying
        const copy = ev.data.slice()
        vadWorker.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer])
      }

      // VAD Worker → Deepgram WebSocket (voiced frames only)
      vadWorker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as {
          type: string
          buffer?: ArrayBuffer
          timestamp?: number
          message?: string
        }

        if (msg.type === 'audio') {
          if (live.getReadyState() !== WebSocket.OPEN) return
          const f32 = new Float32Array(msg.buffer!)
          // AudioContext runs at 16kHz, so no resampling — just float→int16
          const pcm16 = float32ToLinear16Pcm16k(f32, 16000)
          live.send(pcm16.buffer)
        } else if (msg.type === 'speech_start') {
          onSpeechStartRef.current?.(msg.timestamp!)
        } else if (msg.type === 'speech_end') {
          onSpeechEndRef.current?.(msg.timestamp!)
        } else if (msg.type === 'error') {
          // VAD model failed to load — fall back to unfiltered audio
          console.warn('[VAD] Worker error:', msg.message, '— falling back to unfiltered audio')
          worklet.port.onmessage = (ev2: MessageEvent<Float32Array>) => {
            if (live.getReadyState() !== WebSocket.OPEN) return
            const input = ev2.data
            if (!input?.length) return
            const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
            live.send(pcm16.buffer)
          }
        }
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
    let live: LiveClient
    const prewarmed =
      prewarmRef.current?.getReadyState() === WebSocket.OPEN
        ? prewarmRef.current
        : null

    if (prewarmed) {
      live = prewarmed
      prewarmRef.current = null
      liveRef.current = live
      dbgDeepgram({
        hypothesisId: 'H7_reuse_prewarm',
        location: 'useDeepgramProvider.ts:_openConnection',
        message: 'using_prewarmed_socket',
        data: { readyState: live.getReadyState() },
      })
    } else {
      // #region agent log
      const _isJwt = token.startsWith('eyJ') && token.split('.').length === 3
      // #endregion
      dbgDeepgram({
        hypothesisId: 'H3_fresh_ws',
        location: 'useDeepgramProvider.ts:_openConnection',
        message: 'creating_new_live_client',
        data: { tokenLen: token.length, prefix: token.slice(0, 6), isJwt: _isJwt },
      })
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
      const errData = dgErrData(err)
      dbgDeepgram({
        hypothesisId: 'H5_session_err',
        location: 'useDeepgramProvider.ts:_openConnection',
        message: 'LiveTranscriptionEvents.Error',
        data: errData,
      })
      persistDevDeepgramDebug('ms:lastDeepgramWsError', { ...errData, scope: 'session' })
      console.error('[Deepgram] error:', err)
      setError('Deepgram connection error')
      _teardown()
    })

    live.on(LiveTranscriptionEvents.Close, (closeEvent: unknown) => {
      // #region agent log
      const ce2 = closeEvent as { code?: number; reason?: string; wasClean?: boolean } | null
      console.warn('[DG:session:close]', { code: ce2?.code, reason: ce2?.reason, wasClean: ce2?.wasClean })
      dbgDeepgram({
        hypothesisId: 'H1_close_code',
        location: 'useDeepgramProvider.ts:_openConnection.Close',
        message: 'session_ws_close',
        data: { code: ce2?.code, reason: ce2?.reason, wasClean: ce2?.wasClean, readyState: live.getReadyState() },
      })
      // #endregion
      if (activeRef.current || armedRef.current) {
        activeRef.current = false
        armedRef.current = false
        setIsListening(false)
      }
    })

    if (prewarmed) {
      void _setupAudioWorklet(live, stream)
    } else {
      live.on(LiveTranscriptionEvents.Open, () => {
        dbgDeepgram({
          hypothesisId: 'H4_session_open',
          location: 'useDeepgramProvider.ts:_openConnection',
          message: 'LiveTranscriptionEvents.Open',
          data: { readyState: live.getReadyState() },
        })
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

  const onSpeechStart = useCallback((handler: (ts: number) => void) => {
    onSpeechStartRef.current = handler
  }, [])

  const onSpeechEnd = useCallback((handler: (ts: number) => void) => {
    onSpeechEndRef.current = handler
  }, [])

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
    onSpeechStart,
    onSpeechEnd,
  }
}
