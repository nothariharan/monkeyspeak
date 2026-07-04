'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { float32ToLinear16Pcm16k } from '@/lib/pcmDownsample'
import { isFiller } from '@/lib/fillers'
import {
  buildDeepgramBridgeUrl,
  buildDeepgramProxyUrl,
  parseDeepgramWireMessage,
  probeProxyBackendReachable,
} from '@/lib/deepgramConnection'
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

interface LiveAudioSink {
  sendPcm: (buffer: ArrayBufferLike) => void
  sendJson: (payload: object) => void
  isOpen: () => boolean
}

type ListenTarget =
  | { mode: 'proxy'; url: string }
  | { mode: 'bridge'; url: string }
  | { mode: 'none'; error: string }

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

export function useDeepgramProvider(_enabled = true): SpeechProvider {
  const [interimText, setInterimText]       = useState('')
  const [previewWords, setPreviewWords]     = useState<string[]>([])
  const [confirmedWords, setConfirmedWords] = useState<string[]>([])
  const [fillerCount, setFillerCount]       = useState(0)
  const [isListening, setIsListening]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [micStream, setMicStream]           = useState<MediaStream | null>(null)

  const liveRef          = useRef<WebSocket | null>(null)
  const bridgeAbortRef   = useRef<AbortController | null>(null)
  const bridgeWriterRef  = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
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
    if (bridgeAbortRef.current) {
      bridgeAbortRef.current.abort()
      bridgeAbortRef.current = null
    }
    if (bridgeWriterRef.current) {
      void bridgeWriterRef.current.close().catch(() => {})
      bridgeWriterRef.current = null
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
  const _handleDgJson = useCallback((json: string) => {
    if (!activeRef.current) return

    let msg: { type: string }
    try { msg = JSON.parse(json) } catch { return }

    if (msg.type === 'BridgeReady') return

    if (msg.type === 'Error') {
      const message = (msg as { message?: string }).message ?? 'Deepgram connection error'
      console.warn('[STT:deepgram]', message)
      setError(message)
      return
    }

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
    } else if (msg.type !== 'Metadata') {
      console.warn('[STT:deepgram] unhandled event:', msg.type, json.slice(0, 200))
    }
  }, [])

  const _handleDgWire = useCallback(
    (data: unknown) => {
      void parseDeepgramWireMessage(data).then((json) => {
        if (json) _handleDgJson(json)
      })
    },
    [_handleDgJson]
  )

  // ── Audio worklet + VAD setup ─────────────────────────────────────────────
  const _setupAudioWorklet = useCallback(async (sink: LiveAudioSink, stream: MediaStream): Promise<boolean> => {
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
        if (!sessionLive() || !sink.isOpen()) return
        const pcm16 = float32ToLinear16Pcm16k(input, ctx.sampleRate)
        debugBytesSentRef.current += pcm16.byteLength
        sink.sendPcm(pcm16.buffer)
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

          const applyDirectAudioPath = (reason: string) => {
            if (vadFallbackApplied) return
            vadFallbackApplied = true
            console.warn(`[VAD] ${reason} — falling back to unfiltered audio`)
            try { vadWorker.terminate() } catch { /* ignore */ }
            vadWorkerRef.current = null
            bindDirectAudioPath()
          }

          vadWorker.onerror = (err) => {
            console.error('[VAD] Worker load/runtime error:', err)
            applyDirectAudioPath('Worker failed to load')
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
              console.warn('[VAD] Worker error:', msg.message)
              applyDirectAudioPath(msg.message ?? 'Worker error')
            }
          }

          vadWorker.postMessage({ type: 'init' })

          window.setTimeout(() => {
            if (!vadReady && !vadFallbackApplied && sessionLive()) {
              applyDirectAudioPath('Model init timeout (3s)')
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
                  applyDirectAudioPath('No voiced audio detected')
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
        if (sink.isOpen()) {
          sink.sendJson({ type: 'KeepAlive' })
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

  const _connectBridge = useCallback(
    (bridgeUrl: string, stream: MediaStream): Promise<SessionStartResult> =>
      new Promise<SessionStartResult>((resolve) => {
        let settled = false
        const settle = (result: SessionStartResult) => {
          if (!settled) {
            settled = true
            resolve(result)
          }
        }

        const abort = new AbortController()
        bridgeAbortRef.current = abort

        const { readable, writable } = new TransformStream<Uint8Array>()
        const writer = writable.getWriter()
        bridgeWriterRef.current = writer

        const sink: LiveAudioSink = {
          sendPcm: (buffer) => {
            void writer.write(new Uint8Array(buffer)).catch(() => {})
          },
          sendJson: (payload) => {
            void writer.write(new TextEncoder().encode(JSON.stringify(payload))).catch(() => {})
          },
          isOpen: () => !abort.signal.aborted,
        }

        const clearWatchdog = window.setTimeout(() => {
          const msg = 'Deepgram connection timed out — check mic access and try again'
          setError(msg)
          _teardown()
          settle({ ok: false, error: msg })
        }, 25_000)
        let watchdogCleared = false
        const stopWatchdog = () => {
          if (watchdogCleared) return
          watchdogCleared = true
          window.clearTimeout(clearWatchdog)
        }

        const readNdjson = async (body: ReadableStream<Uint8Array>) => {
          const reader = body.getReader()
          const decoder = new TextDecoder()
          let pending = ''

          while (activeRef.current && !abort.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            pending += decoder.decode(value, { stream: true })
            const lines = pending.split('\n')
            pending = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const msg = JSON.parse(line) as { type?: string }
                if (msg.type === 'BridgeReady') stopWatchdog()
              } catch {
                /* ignore */
              }
              _handleDgJson(line)
            }
          }
        }

        void (async () => {
          try {
            // Prime the upload stream so Vercel starts the handler before audio arrives.
            await writer.write(new Uint8Array([0]))

            activeRef.current = true
            const audioSetup = _setupAudioWorklet(sink, stream)

            let response: Response
            try {
              response = await fetch(bridgeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: readable,
                signal: abort.signal,
                duplex: 'half',
              } as RequestInit)
            } catch (fetchErr: unknown) {
              const msg =
                fetchErr instanceof Error && fetchErr.message.includes('duplex')
                  ? 'Your browser does not support audio streaming — try updating your browser or switching to Web Speech mode'
                  : 'Deepgram bridge connection failed — check mic permission and reload'
              setError(msg)
              _teardown()
              settle({ ok: false, error: msg })
              return
            }

            window.clearTimeout(clearWatchdog)
            stopWatchdog()

            if (!response.ok || !response.body) {
              let msg = `Deepgram bridge failed (${response.status})`
              if (response.status === 429) {
                try {
                  const body = await response.clone().json() as { error?: string }
                  msg = body.error ?? 'Daily Deepgram limit reached — switch to browser speech mode'
                } catch { /* ignore */ }
              }
              setError(msg)
              _teardown()
              settle({ ok: false, error: msg })
              return
            }

            sttDebug('Deepgram bridge open', bridgeUrl.replace(/\?.*/, '?…'))

            const audioOk = await audioSetup
            if (!audioOk) {
              settle({ ok: false, error: 'Could not start audio capture' })
              return
            }

            setIsListening(true)
            settle({ ok: true })
            await readNdjson(response.body)
          } catch (err: unknown) {
            stopWatchdog()
            if (abort.signal.aborted) return
            const msg = err instanceof Error ? err.message : 'Deepgram bridge connection failed'
            setError(msg)
            _teardown()
            if (!settled) settle({ ok: false, error: msg })
          } finally {
            if (activeRef.current) {
              setError('Connection lost — press Enter to retry')
              _teardown()
            }
          }
        })()
      }),
    [_teardown, _setupAudioWorklet, _handleDgJson]
  )

  const _connectWebSocket = useCallback(
    (ws: WebSocket, stream: MediaStream, label: string): Promise<SessionStartResult> =>
      new Promise<SessionStartResult>((resolve) => {
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
            const msg = `${label} connection timed out`
            setError(msg)
            _teardown()
            settle({ ok: false, error: msg })
          }, 8_000)
          return () => clearTimeout(tid)
        })()

        ws.onopen = () => {
          clearWatchdog()
          sttDebug('WebSocket open', label)
          activeRef.current = true
          const sink: LiveAudioSink = {
            sendPcm: (buffer) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(buffer)
            },
            sendJson: (payload) => {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
            },
            isOpen: () => ws.readyState === WebSocket.OPEN,
          }
          void _setupAudioWorklet(sink, stream).then((ok) => {
            if (!ok) {
              settle({ ok: false, error: 'Could not start audio capture' })
              return
            }
            setIsListening(true)
            settle({ ok: true })
          })
        }

        ws.onmessage = (ev) => _handleDgWire(ev.data)

        ws.onerror = () => {
          clearWatchdog()
          const msg = `${label} connection failed`
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
            settle({ ok: false, error: `${label} connection closed` })
          }
        }
      }),
    [_teardown, _setupAudioWorklet, _handleDgWire]
  )

  const _resolveListenTarget = useCallback(async (language: string, duration: number): Promise<ListenTarget> => {
    const onLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    // On Vercel, prefer the same-origin HTTP bridge — it runs on the deployment itself
    // and avoids Render cold starts / flaky cross-origin WebSocket upgrades.
    // Local dev still uses ws://localhost:8080 when the standalone backend is up.
    if (onLocalhost) {
      const proxyUrl = buildDeepgramProxyUrl(language)
      if (proxyUrl) {
        const probe = await probeProxyBackendReachable()
        if (probe.ok) return { mode: 'proxy', url: proxyUrl }
        sttDebug('local proxy offline', probe.err ?? probe.status)
      }
    }

    return { mode: 'bridge', url: buildDeepgramBridgeUrl(language, duration) }
  }, [])

  // ── Open proxy or direct (ephemeral key) Deepgram connection ───────────
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
    const duration = useTestStore.getState().duration ?? 30
    const target = await _resolveListenTarget(language, duration)
    if (target.mode === 'none') {
      setError(target.error)
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setMicStream(null)
      return { ok: false, error: target.error }
    }

    if (target.mode === 'bridge') {
      return _connectBridge(target.url, stream)
    }

    return _connectWebSocket(new WebSocket(target.url), stream, 'Deepgram proxy')
  }, [_resolveListenTarget, _connectBridge, _connectWebSocket])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    if (activeRef.current && (liveRef.current?.readyState === WebSocket.OPEN || bridgeAbortRef.current)) {
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
