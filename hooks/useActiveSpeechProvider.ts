'use client'

import { useWebSpeech } from './useWebSpeech'
import { useDeepgramProvider } from './useDeepgramProvider'
import type { ProviderType, SpeechProvider } from './useSpeechProvider'

/**
 * Both hooks are always mounted — this satisfies Rules of Hooks.
 * The parent controls which provider is active by only calling
 * startSession / stopSession on the selected one.
 */
export function useActiveSpeechProvider(provider: ProviderType): SpeechProvider {
  const webSpeech = useWebSpeech()
  const deepgram  = useDeepgramProvider()

  return provider === 'webspeech' ? webSpeech : deepgram
}
