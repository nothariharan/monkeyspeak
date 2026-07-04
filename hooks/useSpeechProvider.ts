'use client'

// shared stt provider interface — webspeech and deepgram both implement this

/** one finalised word, optional timing from deepgram */
export interface EnrichedWord {
  word: string
  /** seconds from stream start (deepgram) */
  start?: number
  end?: number
  /** asr confidence 0–1 (deepgram) */
  confidence?: number
}

export interface SpeechProviderState {
  /** live interim transcript */
  interimText: string
  /** unconfirmed words for instant ui progress */
  previewWords: string[]
  /** finalised words this session */
  confirmedWords: string[]
  fillerCount: number
  isListening: boolean
  error: string | null
  micStream: MediaStream | null
  /** browser stt path can signal audio without a mediastream */
  audioActive?: boolean
}

export interface SpeechProviderActions {
  /** warm mic + ws during countdown (deepgram only) */
  armSession?: () => Promise<SessionStartResult>
  startSession: () => Promise<SessionStartResult>
  /** bail out of stuck browser stt and try deepgram */
  retryWithDeepgram?: () => Promise<SessionStartResult>
  stopSession: () => void
  reset: () => void
  /** vad speech start hook (~32ms, deepgram path) */
  onSpeechStart?: (handler: (ts: number) => void) => void
  /** vad speech end hook (deepgram path) */
  onSpeechEnd?: (handler: (ts: number) => void) => void
}

export type SpeechProvider = SpeechProviderState & SpeechProviderActions

export type ProviderType = 'webspeech' | 'deepgram'

/** arm/start result — error set when ok is false */
export type SessionStartResult =
  | { ok: true }
  | { ok: false; error: string }
