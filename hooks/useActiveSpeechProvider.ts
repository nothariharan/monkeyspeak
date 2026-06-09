'use client'

import { useCallback } from 'react'
import { useWebSpeech } from './useWebSpeech'
import { useDeepgramProvider } from './useDeepgramProvider'
import { useTestStore } from '@/store/testStore'
import type { ProviderType, SpeechProvider, SessionStartResult } from './useSpeechProvider'

/**
 * Both hooks are always mounted — this satisfies Rules of Hooks.
 * Deepgram failures automatically fall back to browser Web Speech API.
 */
export function useActiveSpeechProvider(provider: ProviderType): SpeechProvider {
  const webSpeech = useWebSpeech()
  const deepgram  = useDeepgramProvider(provider === 'deepgram')

  const active = provider === 'webspeech' ? webSpeech : deepgram

  const startSession = useCallback(async (): Promise<SessionStartResult> => {
    if (provider === 'deepgram') {
      const result = await deepgram.startSession()
      if (result.ok) return result

      deepgram.stopSession()
      const fallback = await webSpeech.startSession()
      if (fallback.ok) {
        useTestStore.getState().setSttProvider('webspeech')
        return fallback
      }
      return result
    }
    return webSpeech.startSession()
  }, [provider, deepgram, webSpeech])

  const stopSession = useCallback(() => {
    webSpeech.stopSession()
    deepgram.stopSession()
  }, [webSpeech, deepgram])

  const reset = useCallback(() => {
    webSpeech.reset()
    deepgram.reset()
  }, [webSpeech, deepgram])

  return {
    ...active,
    startSession,
    stopSession,
    reset,
  }
}
