'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebSpeech } from './useWebSpeech'
import { useDeepgramProvider } from './useDeepgramProvider'
import { useTestStore } from '@/store/testStore'
import { getBrowserSpeechProfile } from '@/lib/browserSpeech'
import type { ProviderType, SpeechProvider, SessionStartResult } from './useSpeechProvider'

export type ActiveSpeechProvider = SpeechProvider & {
  /** whoever is actually feeding transcripts right now */
  activeSource: ProviderType
  /** set when we auto-fallback deepgram → webspeech */
  fallbackMessage: string | null
  clearFallbackMessage: () => void
}

// both hooks stay mounted (rules of hooks)
// browser mode = webspeech only
// deepgram mode = try deepgram first, fallback to webspeech on chrome if it dies
export function useActiveSpeechProvider(provider: ProviderType): ActiveSpeechProvider {
  const webSpeech = useWebSpeech()
  const deepgram = useDeepgramProvider(true)

  const [activeSource, setActiveSource] = useState<ProviderType>(provider)
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)
  const usingDeepgramRef = useRef(false)

  useEffect(() => {
    setActiveSource(provider)
  }, [provider])

  const active = activeSource === 'deepgram' ? deepgram : webSpeech

  const startDeepgramSession = useCallback(async (): Promise<SessionStartResult> => {
    webSpeech.stopSession()
    webSpeech.reset()
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

      // deepgram died — on brave/edge webspeech is blocked too so don't fallback
      deepgram.stopSession()
      const profile = await getBrowserSpeechProfile()
      if (profile.preferDeepgram) {
        return result
      }

      setActiveSource('webspeech')
      const fallback = await webSpeech.startSession()
      if (fallback.ok) {
        useTestStore.getState().setSttProvider('webspeech')
        setFallbackMessage('Switched to browser speech — Deepgram unavailable')
        return fallback
      }
      return result
    }

    setActiveSource('webspeech')
    return webSpeech.startSession()
  }, [provider, deepgram, webSpeech, startDeepgramSession])

  const retryWithDeepgram = useCallback(async (): Promise<SessionStartResult> => {
    // mic hot but no words — force a fresh Deepgram session even if one already
    // claims to be listening (common when the fragile HTTP bridge "opens" with no Results)
    deepgram.stopSession()
    webSpeech.stopSession()
    usingDeepgramRef.current = false
    const result = await startDeepgramSession()
    if (result.ok) {
      useTestStore.getState().setSttProvider('deepgram')
    }
    return result
  }, [deepgram, webSpeech, startDeepgramSession])

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
    fallbackMessage,
    clearFallbackMessage: useCallback(() => setFallbackMessage(null), []),
  }
}
