'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebSpeech } from './useWebSpeech'
import { useDeepgramProvider } from './useDeepgramProvider'
import { useTestStore } from '@/store/testStore'
import type { ProviderType, SpeechProvider, SessionStartResult } from './useSpeechProvider'

export type ActiveSpeechProvider = SpeechProvider & {
  /** Provider actually driving transcripts (may differ after fallback). */
  activeSource: ProviderType
}

/**
 * both speech hooks stay mounted (rules of hooks).
 * browser mode = web speech only.
 * deepgram mode = try deepgram first, fall back to web speech if it dies.
 */
export function useActiveSpeechProvider(provider: ProviderType): ActiveSpeechProvider {
  const webSpeech = useWebSpeech()
  const deepgram = useDeepgramProvider(true)

  const [activeSource, setActiveSource] = useState<ProviderType>(provider)
  const usingDeepgramRef = useRef(false)

  useEffect(() => {
    setActiveSource(provider)
  }, [provider])

  const active = activeSource === 'deepgram' ? deepgram : webSpeech

  const startDeepgramSession = useCallback(async (): Promise<SessionStartResult> => {
    webSpeech.stopSession()
    setActiveSource('deepgram')
    const result = await deepgram.startSession()
    if (result.ok) {
      usingDeepgramRef.current = true
    } else {
      usingDeepgramRef.current = false
    }
    return result
  }, [webSpeech, deepgram])

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    usingDeepgramRef.current = false

    if (provider === 'deepgram') {
      const result = await startDeepgramSession()
      if (result.ok) return result

      // deepgram flaked. stop it cleanly and try browser speech before giving up.
      deepgram.stopSession()
      setActiveSource('webspeech')
      const fallback = await webSpeech.startSession()
      if (fallback.ok) {
        useTestStore.getState().setSttProvider('webspeech')
        return fallback
      }
      return result
    }

    setActiveSource('webspeech')
    return webSpeech.startSession()
  }, [provider, deepgram, webSpeech, startDeepgramSession])

  const retryWithDeepgram = useCallback(async (): Promise<SessionStartResult> => {
    // runtime failsafe: mic is hot but no words after a few seconds
    if (usingDeepgramRef.current && activeSource === 'deepgram') return { ok: true }
    deepgram.stopSession()
    webSpeech.stopSession()
    const result = await startDeepgramSession()
    if (result.ok) {
      useTestStore.getState().setSttProvider('deepgram')
    }
    return result
  }, [deepgram, webSpeech, startDeepgramSession, activeSource])

  const stopSession = useCallback(() => {
    usingDeepgramRef.current = false
    webSpeech.stopSession()
    deepgram.stopSession()
  }, [webSpeech, deepgram])

  const reset = useCallback(() => {
    usingDeepgramRef.current = false
    webSpeech.reset()
    deepgram.reset()
  }, [webSpeech, deepgram])

  return {
    ...active,
    activeSource,
    startSession,
    retryWithDeepgram,
    stopSession,
    reset,
  }
}
