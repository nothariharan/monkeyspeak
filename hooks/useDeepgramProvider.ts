'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import { useTestStore } from '@/store/testStore'
import type { SpeechProvider, EnrichedWord } from './useSpeechProvider'

// ── Deepgram JSON wire types ──────────────────────────────────────────────────
interface DgWord {
  word: string
  start: number
  end: number
  confidence: number
  punctuated_word?: string
}

interface DgResultsEvent {
  type: 'Results'
  is_final: boolean
  speech_final: boolean
  channel: { alternatives: Array<{ transcript: string; confidence: number; words?: DgWord[] }> }
}

interface DgSpeechStartedEvent { type: 'SpeechStarted'; timestamp?: number }
interface DgUtteranceEndEvent  { type: 'UtteranceEnd' }

// ── Proxy URL builder ─────────────────────────────────────────────────────────
function buildProxyUrl(language: string): string {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base) throw new Error('NEXT_PUBLIC_DEEPGRAM_PROXY_URL is not set')
  const url = new URL(base)
  url.searchParams.set('lang', language)
  return url.toString()
}

/** `ws://host:port/...` → `http://host:port/` for GET / health check (backend must be up). */
function proxyHttpOrigin(): string {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base) throw new Error('NEXT_PUBLIC_DEEPGRAM_PROXY_URL is not set')
  const u = new URL(base)
  const proto = u.protocol === 'wss:' ? 'https:' : 'http:'
  return `${proto}//${u.host}/`
}

async function probeProxyBackendReachable(): Promise<{ ok: boolean; status?: number; err?: string }> {
  try {
    const origin = proxyHttpOrigin()
    const r = await fetch(origin, { method: 'GET', mode: 'cors', cache: 'no-store' })
    return { ok: r.ok, status: r.status }
  } catch (e) {
    return { ok: false, err: String(e) }
  }
}

/**
 * No-op now that the proxy handles auth server-side — kept so ConfigBar's
 * call to prefetchDeepgramKey() continues to compile.
 */
export async function prefetchDeepgramKey(): Promise<void> {}

export function useDeepgramProvider(): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [enrichedWords, setEnrichedWords]   = useState<EnrichedWord[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const liveRef          = useRef<WebSocket | null>(null)
  const prewarmRef       = useRef<WebSocket | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const workletRef       = useRef<AudioWorkletNode | null>(null)
  const contextRef       = useRef<AudioContext | null>(null)
  const vadWorkerRef     = useRef<Worker | null>(null)
  const keepAliveRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef        = useRef(false)
  const armedRef         = useRef(false)
  const onSpeechStartRef = useRef<((ts: number) => void) | null>(null)
  const onSpeechEndRef   = useRef<((ts: number) => void) | null>(null)

  // ── Pre-warm the proxy WebSocket on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function prewarm() {
      const language = useTestStore.getState().settings.language ?? 'en-US'
      let url: string
      try {
        url = buildProxyUrl(language)
      } catch {
        return
      }

      const probe = await probeProxyBackendReachable()
      if (!probe.ok) {
        setError(
          'Deepgram proxy is offline. Start the backend from the project folder: cd backend then node index.js (listen on port 8080), then refresh this page.'
        )
        return
      }
      if (cancelled) return

      const ws = new WebSocket(url)
      prewarmRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
      }

      ws.onerror = () => {
        if (prewarmRef.current === ws) prewarmRef.current = null
      }

      ws.onclose = () => {
        if (prewarmRef.current === ws) prewarmRef.current = null
      }
    }

    void prewarm()

    return () => {
      cancelled = true
      if (prewarmRef.current) {
        try { prewarmRef.current.close() } catch { /* ignore */ }
        prewarmRef.current = null
      }
    }
  }, [])

  // ── Teardown ──────────────────────────────────────────────────────────────
  const _teardown = useCallback(() => {
    activeRef.current = false

    if (keepAliveRef.current != null) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
    if (vadWorkerRef.current) {
      try { vadWorkerRef.current.postMessage({ type: 'reset' }); vadWorkerRef.current.terminate() } catch { /* ignore */ }
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
      try { liveRef.current.close() } catch { /* ignore */ }
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

  // ── Deepgram JSON event handler (same wire format regardless of proxy) ────
  const _handleDgMessage = useCallback((ev: MessageEvent) => {
    if (!activeRef.current) return
    if (typeof ev.data !== 'string') return

    let msg: { type: string }
    try { msg = JSON.parse(ev.data) } catch { return }

    if (msg.type === 'Results') {
      const r = msg as DgResultsEvent
      const alt = r.channel?.alternatives?.[0]
      if (!alt) return

      const transcript = (alt.transcript ?? '').trim()
      if (!transcript) return

      if (!r.is_final) {
        // #region agent log
        fetch('http://127.0.0.1:7291/ingest/74562f5e-377a-4199-9293-9988125476d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260cc1'},body:JSON.stringify({sessionId:'260cc1',hypothesisId:'B',location:'useDeepgramProvider.ts:195',message:'DG interim result received',data:{transcript,isFinal:false,speechFinal:r.speech_final,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        setInterimText(transcript)
        return
      }

      // #region agent log
      fetch('http://127.0.0.1:7291/ingest/74562f5e-377a-4199-9293-9988125476d2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260cc1'},body:JSON.stringify({sessionId:'260cc1',hypothesisId:'C',location:'useDeepgramProvider.ts:202',message:'DG FINAL result received (is_final=true)',data:{transcript,speechFinal:r.speech_final,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      setInterimText('')

      const wordObjs = (alt.words ?? []) as DgWord[]
      let newFillers = 0
      const realWords: string[] = []
      const realEnriched: EnrichedWord[] = []

      if (wordObjs.length > 0) {
        for (const w of wordObjs) {
          if (isFiller(w.word)) {
            newFillers++
          } else {
            realWords.push(w.word)
            realEnriched.push({ word: w.word, start: w.start, end: w.end, confidence: w.confidence })
          }
        }
      } else {
        for (const w of transcript.split(/\s+/).filter(Boolean)) {
          if (isFiller(w)) { newFillers++ } else {
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
    } else if (msg.type === 'SpeechStarted') {
      onSpeechStartRef.current?.((msg as DgSpeechStartedEvent).timestamp ?? Date.now())
    } else if (msg.type === 'UtteranceEnd') {
      onSpeechEndRef.current?.(Date.now())
    }
  }, [])

  // ── Audio worklet + VAD setup ─────────────────────────────────────────────
  const _setupAudioWorklet = useCallback(async (ws: WebSocket, stream: MediaStream) => {
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

      const vadWorker = new Worker('/vad-worker.js')
      vadWorkerRef.current = vadWorker
      vadWorker.postMessage({ type: 'init' })

      worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        if (!ev.data?.length || !activeRef.current) return
        const copy = ev.data.slice()
        vadWorker.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer])
      }

      vadWorker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type: string; buffer?: ArrayBuffer; timestamp?: number; message?: string }

        if (msg.type === 'audio') {
          if (ws.readyState !== WebSocket.OPEN) return
          const f32 = new Float32Array(msg.buffer!)
          const pcm16 = float32ToLinear16Pcm16k(f32, 16000)
          ws.send(pcm16.buffer)
        } else if (msg.type === 'speech_start') {
          onSpeechStartRef.current?.(msg.timestamp!)
        } else if (msg.type === 'speech_end') {
          onSpeechEndRef.current?.(msg.timestamp!)
        } else if (msg.type === 'error') {
          console.warn('[VAD] Worker error:', msg.message, '— falling back to unfiltered audio')
          worklet.port.onmessage = (ev2: MessageEvent<Float32Array>) => {
            if (ws.readyState !== WebSocket.OPEN) return
            const input = ev2.data
            if (!input?.length) return
            const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
            ws.send(pcm16.buffer)
          }
        }
      }

      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(worklet)
      worklet.connect(mute)
      mute.connect(ctx.destination)

      // KeepAlive: prevent Deepgram from closing the connection during silence
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 8_000)

      if (activeRef.current) setIsListening(true)
    } catch {
      setError('Could not start audio capture')
      _teardown()
    }
  }, [_teardown])

  // ── Open (or reuse prewarmed) proxy connection ───────────────────────────
  const _openConnection = useCallback(async (): Promise<boolean> => {
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 }, echoCancellation: true, noiseSuppression: true },
        video: false,
      })
    } catch (err: unknown) {
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setError(isDenied ? 'Microphone permission denied' : 'Could not start microphone')
      return false
    }
    streamRef.current = stream
    setMicStream(stream)

    const prewarmed = prewarmRef.current?.readyState === WebSocket.OPEN ? prewarmRef.current : null

    if (prewarmed) {
      prewarmRef.current = null
      liveRef.current = prewarmed
      prewarmed.onmessage = _handleDgMessage
      prewarmed.onerror = () => { setError('Deepgram proxy error'); _teardown() }
      prewarmed.onclose = () => {
        if (activeRef.current || armedRef.current) { activeRef.current = false; armedRef.current = false; setIsListening(false) }
      }
      void _setupAudioWorklet(prewarmed, stream)
      return true
    }

    // Fresh connection
    const language = useTestStore.getState().settings.language ?? 'en-US'
    let url: string
    try { url = buildProxyUrl(language) } catch (e) {
      setError(String(e))
      return false
    }

    const probe = await probeProxyBackendReachable()
    if (!probe.ok) {
      setError(
        'Deepgram proxy is offline. Start the backend from the project folder: cd backend then node index.js (listen on port 8080), then try again.'
      )
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicStream(null)
      return false
    }

    return new Promise<boolean>((resolve) => {
      const ws = new WebSocket(url)
      liveRef.current = ws
      let settled = false
      const settle = (ok: boolean) => { if (!settled) { settled = true; resolve(ok) } }

      const clearWatchdog = (() => {
        const tid = window.setTimeout(() => { setError('Proxy connection timed out'); _teardown(); settle(false) }, 8_000)
        return () => clearTimeout(tid)
      })()

      ws.onopen = () => {
        clearWatchdog()
        void _setupAudioWorklet(ws, stream)
        settle(true)
      }

      ws.onmessage = _handleDgMessage

      ws.onerror = () => {
        clearWatchdog()
        setError('Deepgram proxy connection failed')
        _teardown()
        settle(false)
      }

      ws.onclose = () => {
        clearWatchdog()
        if (activeRef.current || armedRef.current) { activeRef.current = false; armedRef.current = false; setIsListening(false) }
        settle(false)
      }
    })
  }, [_teardown, _setupAudioWorklet, _handleDgMessage])

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
      if (liveRef.current.readyState === WebSocket.OPEN) setIsListening(true)
      return true
    }
    const ok = await _openConnection()
    if (!ok) return false
    activeRef.current = true
    if (liveRef.current?.readyState === WebSocket.OPEN) setIsListening(true)
    return true
  }, [_openConnection])

  const onSpeechStart = useCallback((handler: (ts: number) => void) => { onSpeechStartRef.current = handler }, [])
  const onSpeechEnd   = useCallback((handler: (ts: number) => void) => { onSpeechEndRef.current = handler }, [])

  useEffect(() => () => { _teardown() }, [_teardown])

  return { interimText, confirmedWords, enrichedWords, fillerCount, isListening, error, micStream, armSession, startSession, stopSession, reset, onSpeechStart, onSpeechEnd }
}
