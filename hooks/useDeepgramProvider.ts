'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import { useTestStore } from '@/store/testStore'
import type { SpeechProvider, SessionStartResult } from './useSpeechProvider'

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

const DEBUG_STT = process.env.NEXT_PUBLIC_DEBUG_STT === 'true'

function sttDebug(...args: unknown[]) {
  if (DEBUG_STT) console.debug('[STT:deepgram]', ...args)
}

function displayTranscript(
  alt: { transcript?: string; words?: DgWord[] }
): string {
  const t = (alt.transcript ?? '').trim()
  if (t) return t
  const words = alt.words ?? []
  if (words.length === 0) return ''
  return words.map((w) => (w.punctuated_word ?? w.word).trim()).filter(Boolean).join(' ')
}

// ── Proxy URL builder ─────────────────────────────────────────────────────────
function buildProxyUrl(language: string): string {
  const base = process.env.NEXT_PUBLIC_DEEPGRAM_PROXY_URL
  if (!base) throw new Error('NEXT_PUBLIC_DEEPGRAM_PROXY_URL is not set')
  const url = new URL(base)
  url.searchParams.set('lang', language)
  url.searchParams.set('interim_results', 'true')
  url.searchParams.set('vad_events', 'true')
  url.searchParams.set('utterance_end_ms', '250')
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

export function useDeepgramProvider(enabled = true): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [previewWords, setPreviewWords]     = useState<string[]>([])
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const liveRef          = useRef<WebSocket | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const workletRef       = useRef<AudioWorkletNode | null>(null)
  const contextRef       = useRef<AudioContext | null>(null)
  const vadWorkerRef     = useRef<Worker | null>(null)
  const keepAliveRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef        = useRef(false)
  const onSpeechStartRef = useRef<((ts: number) => void) | null>(null)
  const onSpeechEndRef   = useRef<((ts: number) => void) | null>(null)
  const debugBytesSentRef = useRef(0)
  const debugResultsRef   = useRef(0)
  const previewWordsRef   = useRef<string[]>([])

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
      try {
        if (liveRef.current.readyState === WebSocket.OPEN) {
          liveRef.current.send(JSON.stringify({ type: 'CloseStream' }))
        }
        liveRef.current.close()
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
    previewWordsRef.current = []
    setPreviewWords([])
  }, [])

  const reset = useCallback(() => {
    setInterimText('')
    previewWordsRef.current = []
    setPreviewWords([])
    setConfirmedWords([])
    setFillerCount(0)
    setError(null)
  }, [])

  const stopSession = useCallback(() => {
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

      const wordObjs = (alt.words ?? []) as DgWord[]
      const transcript = displayTranscript(alt)
      if (!transcript && wordObjs.length === 0) return

      debugResultsRef.current++
      sttDebug(r.is_final ? 'final' : 'interim', transcript.slice(0, 80), `words=${wordObjs.length}`)

      if (!r.is_final) {
        setInterimText(transcript)
        const previewBatch = (wordObjs.length > 0
          ? wordObjs.map((w) => w.word)
          : transcript.split(/\s+/).filter(Boolean))
          .map((word) => word.toLowerCase().replace(/[^a-z0-9']/g, '').trim())
          .filter(Boolean)
          .filter((word) => !isFiller(word))

        if (previewBatch.length === 0) {
          previewWordsRef.current = []
          setPreviewWords([])
        } else if (previewBatch.length >= previewWordsRef.current.length) {
          previewWordsRef.current = previewBatch
          setPreviewWords(previewBatch)
        }
        return
      }

      setInterimText('')
      previewWordsRef.current = []
      setPreviewWords([])
      let newFillers = 0
      const realWords: string[] = []

      if (wordObjs.length > 0) {
        for (const w of wordObjs) {
          const normalized = w.word.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
          if (!normalized) continue
          if (isFiller(normalized)) {
            newFillers++
          } else {
            realWords.push(normalized)
          }
        }
      } else {
        for (const w of transcript.split(/\s+/).filter(Boolean)) {
          const normalized = w.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
          if (!normalized) continue
          if (isFiller(normalized)) { newFillers++ } else {
            realWords.push(normalized)
          }
        }
      }

      if (newFillers > 0) setFillerCount((c) => c + newFillers)
      if (realWords.length > 0) {
        setConfirmedWords((prev) => [...prev, ...realWords])
      }
    } else if (msg.type === 'SpeechStarted') {
      onSpeechStartRef.current?.((msg as DgSpeechStartedEvent).timestamp ?? Date.now())
    } else if (msg.type === 'UtteranceEnd') {
      onSpeechEndRef.current?.(Date.now())
    }
  }, [])

  // ── Audio worklet + VAD setup ─────────────────────────────────────────────
  const _setupAudioWorklet = useCallback(async (ws: WebSocket, stream: MediaStream): Promise<boolean> => {
    const sessionLive = () => activeRef.current

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

      const skipVad = useTestStore.getState().settings.skipVad ?? false

      const sendPcm = (input: Float32Array) => {
        if (!sessionLive() || ws.readyState !== WebSocket.OPEN) return
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        debugBytesSentRef.current += pcm16.byteLength
        ws.send(pcm16.buffer)
      }

      const bindDirectAudioPath = () => {
        sttDebug('audio path: direct (unfiltered)')
        worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
          if (!ev.data?.length || !sessionLive()) return
          sendPcm(ev.data)
        }
      }

      if (skipVad) {
        sttDebug('audio path: direct (skip VAD)')
        bindDirectAudioPath()
      } else {
        try {
          const vadWorker = new Worker('/vad-worker.js')
          vadWorkerRef.current = vadWorker

          let vadReady = false
          let vadPcmSent = 0
          let vadAudioReceived = 0
          let vadFallbackApplied = false

          const applyDirectAudioPath = () => {
            if (vadFallbackApplied) return
            vadFallbackApplied = true
            console.warn('[VAD] No voiced audio detected — falling back to unfiltered audio')
            try { vadWorker.terminate() } catch { /* ignore */ }
            vadWorkerRef.current = null
            bindDirectAudioPath()
          }

          vadWorker.onerror = (err) => {
            console.error('[VAD] Worker load/runtime error:', err, '— falling back to unfiltered audio')
            applyDirectAudioPath()
          }

          vadWorker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data as { type: string; buffer?: ArrayBuffer; timestamp?: number; message?: string }

            if (msg.type === 'ready') {
              vadReady = true
              return
            }
            if (msg.type === 'audio') {
              vadAudioReceived++
              sendPcm(new Float32Array(msg.buffer!))
            } else if (msg.type === 'speech_start') {
              sttDebug('VAD speech_start')
              onSpeechStartRef.current?.(msg.timestamp!)
            } else if (msg.type === 'speech_end') {
              sttDebug('VAD speech_end')
              onSpeechEndRef.current?.(msg.timestamp!)
            } else if (msg.type === 'error') {
              console.warn('[VAD] Worker error:', msg.message, '— falling back to unfiltered audio')
              applyDirectAudioPath()
            }
          }

          vadWorker.postMessage({ type: 'init' })

          window.setTimeout(() => {
            if (!vadReady && !vadFallbackApplied && sessionLive()) {
              console.warn('[VAD] Model init timeout (3s) — falling back to unfiltered audio')
              applyDirectAudioPath()
            }
          }, 3000)

          worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
            if (!ev.data?.length || !sessionLive()) return
            if (vadFallbackApplied) {
              sendPcm(ev.data)
              return
            }
            vadPcmSent++
            if (vadPcmSent === 32) {
              window.setTimeout(() => {
                if (!vadFallbackApplied && vadAudioReceived === 0 && sessionLive()) {
                  applyDirectAudioPath()
                }
              }, 2000)
            }
            const copy = ev.data.slice()
            vadWorker.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer])
          }
        } catch (workerErr) {
          console.error('[VAD] Failed to create Worker:', workerErr, '— falling back to unfiltered audio')
          bindDirectAudioPath()
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
      }, 3_000)

      if (sessionLive()) setIsListening(true)
      return true
    } catch {
      setError('Could not start audio capture')
      _teardown()
      return false
    }
  }, [_teardown])

  // ── Open (or reuse prewarmed) proxy connection ───────────────────────────
  const _openConnection = useCallback(async (): Promise<SessionStartResult> => {
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 }, echoCancellation: true, noiseSuppression: true },
        video: false,
      })
    } catch (err: unknown) {
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      const msg = isDenied ? 'Microphone permission denied' : 'Could not start microphone'
      setError(msg)
      return { ok: false, error: msg }
    }
    streamRef.current = stream
    setMicStream(stream)

    const language = useTestStore.getState().settings.language ?? 'en-US'
    let url: string
    try { url = buildProxyUrl(language) } catch (e) {
      const msg = String(e)
      setError(msg)
      return { ok: false, error: msg }
    }

    const probe = await probeProxyBackendReachable()
    if (!probe.ok) {
      const msg =
        'Deepgram proxy is offline. Run `npm run dev:backend` in a second terminal (port 8080), or switch STT to browser in settings.'
      setError(msg)
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicStream(null)
      return { ok: false, error: msg }
    }

    return new Promise<SessionStartResult>((resolve) => {
      const ws = new WebSocket(url)
      liveRef.current = ws
      let settled = false
      const settle = (result: SessionStartResult) => {
        if (!settled) {
          settled = true
          resolve(result)
        }
      }

      const clearWatchdog = (() => {
        const tid = window.setTimeout(() => {
          const msg = 'Proxy connection timed out'
          setError(msg)
          _teardown()
          settle({ ok: false, error: msg })
        }, 8_000)
        return () => clearTimeout(tid)
      })()

      ws.onopen = () => {
        clearWatchdog()
        sttDebug('WebSocket open', url.replace(/\?.*/, '?…'))
        activeRef.current = true
        void _setupAudioWorklet(ws, stream).then((ok) => {
          if (!ok) {
            settle({ ok: false, error: 'Could not start audio capture' })
            return
          }
          setIsListening(true)
          settle({ ok: true })
        })
      }

      ws.onmessage = _handleDgMessage

      ws.onerror = () => {
        clearWatchdog()
        const msg = 'Deepgram proxy connection failed'
        setError(msg)
        _teardown()
        settle({ ok: false, error: msg })
      }

      ws.onclose = () => {
        clearWatchdog()
        if (activeRef.current) {
          setError('Connection lost — press Enter to retry')
          _teardown()
        }
        if (!settled) {
          settle({ ok: false, error: 'Deepgram proxy connection closed' })
        }
      }
    })
  }, [_teardown, _setupAudioWorklet, _handleDgMessage])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    if (activeRef.current && liveRef.current?.readyState === WebSocket.OPEN) {
      setIsListening(true)
      return { ok: true }
    }
    return _openConnection()
  }, [_openConnection])

  const armSession = startSession

  const onSpeechStart = useCallback((handler: (ts: number) => void) => { onSpeechStartRef.current = handler }, [])
  const onSpeechEnd   = useCallback((handler: (ts: number) => void) => { onSpeechEndRef.current = handler }, [])

  useEffect(() => () => { _teardown() }, [_teardown])

  return { interimText, previewWords, confirmedWords, fillerCount, isListening, error, micStream, armSession, startSession, stopSession, reset, onSpeechStart, onSpeechEnd }
}
