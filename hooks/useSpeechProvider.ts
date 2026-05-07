'use client'

// ─── Shared STT provider interface ──────────────────────────────────────────
// Neither useWebSpeech nor useDeepgramProvider are imported directly anywhere
// outside their own hook. Everything else talks to this shape.

export interface SpeechProviderState {
  /** Current interim (unconfirmed) transcript from the STT engine. */
  interimText: string
  /** Words that have been finalised by the STT engine this session. */
  confirmedWords: string[]
  /** Number of filler words detected this session. */
  fillerCount: number
  /** True between startSession() and stopSession(). */
  isListening: boolean
  /** Non-null when the provider has encountered an error. */
  error: string | null
  /** Raw MediaStream, forwarded to WaveformVisualiser. */
  micStream: MediaStream | null
}

export interface SpeechProviderActions {
  startSession: () => Promise<boolean>
  stopSession: () => void
  /** Clears interimText, confirmedWords, fillerCount, and resets internal refs. */
  reset: () => void
}

export type SpeechProvider = SpeechProviderState & SpeechProviderActions

export type ProviderType = 'webspeech' | 'deepgram'
