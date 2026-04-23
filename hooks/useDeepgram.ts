'use client'

import { useRef, useCallback, useState } from 'react'
import { useTestStore } from '@/store/testStore'
import { isFiller } from '@/lib/fillers'
import type { WordResult } from '@/store/testStore'

interface UseDeepgramReturn {
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  micStream: MediaStream | null
  liveTranscript: string
  startStream: () => Promise<boolean>
  stopStream: () => void
}

/**
 * Manages the Deepgram WebSocket connection and microphone stream.
 * Gets a short-lived token from /api/deepgram/token, opens the WS,
 * pipes getUserMedia PCM audio, and dispatches word events to the store.
 */
export function useDeepgram(
  onWord: (result: WordResult) => void,
  onFiller: () => void
): UseDeepgramReturn {
  const { micState, setMicState, settings } = useTestStore()
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const wsRef         = useRef<WebSocket | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const processorRef  = useRef<ScriptProcessorNode | null>(null)
  const contextRef    = useRef<AudioContext | null>(null)

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

      // 1. Get ephemeral Deepgram token from server
      const tokenRes = await fetch('/api/deepgram/token')
      if (!tokenRes.ok) throw new Error('Failed to get Deepgram token')
      const { key } = await tokenRes.json()

      // 2. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      setMicStream(stream)
      setMicState('active')

      // 3. Build Deepgram WebSocket URL with config from PRD §7.2
      const lang = settings.language ?? 'en-US'
      const params = new URLSearchParams({
        model:            'nova-2',
        language:         lang,
        smart_format:     'true',
        disfluencies:     'true',
        interim_results:  'true',
        utterance_end_ms: '1000',
        vad_events:       'true',
        encoding:         'linear16',
        sample_rate:      '16000',
      })
      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

      const ws = new WebSocket(wsUrl, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        // 4. Pipe microphone PCM audio into WebSocket
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx({ sampleRate: 16000 })
        contextRef.current = ctx

        const source    = ctx.createMediaStreamSource(stream)
        // ScriptProcessor deprecated but still widely supported
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const input    = e.inputBuffer.getChannelData(0)
          const int16    = new Int16Array(input.length)
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
          const data = JSON.parse(event.data)

          // Update live ghost transcript
          if (data.channel?.alternatives?.[0]?.transcript) {
            setLiveTranscript(data.channel.alternatives[0].transcript)
          }

          // Only process final (is_final) word events
          if (!data.is_final) return

          const words: Array<{ word: string; start: number; end: number; confidence: number }> =
            data.channel?.alternatives?.[0]?.words ?? []

          for (const w of words) {
            const wordStr = w.word.toLowerCase().trim()
            if (!wordStr) continue

            if (isFiller(wordStr)) {
              onFiller()
            } else {
              const result: WordResult = {
                word:      wordStr,
                isCorrect: true,   // correctness matched against prompt in TestArea
                isFiller:  false,
                timestamp: Date.now(),
              }
              onWord(result)
            }
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
        // Normal closure — state already updated by caller
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
  }, [settings.language, setMicState, onWord, onFiller, stopStream])

  return { micState, micStream, liveTranscript, startStream, stopStream }
}
