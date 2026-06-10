'use client'

// ─── Shared STT provider interface ──────────────────────────────────────────

/** A finalised word with optional per-word timing and confidence from Deepgram. */
export interface EnrichedWord {
  word: string
  /** Seconds from the start of the audio stream (Deepgram only). */
  start?: number
  /** Seconds from the start of the audio stream (Deepgram only). */
  end?: number
  /** ASR confidence score 0–1 (Deepgram only). */
  confidence?: number
}

export interface SpeechProviderState {
  /** Current interim (unconfirmed) transcript from the STT engine. */
  interimText: string
  /** Non-final spoken words used only for immediate live UI progress. */
  previewWords: string[]
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
  /** True when the browser STT path detects live audio (no MediaStream required). */
  audioActive?: boolean
}

export interface SpeechProviderActions {
  /**
   * Optional warm-connect: opens mic + WS during the 3-2-1 countdown so
   * startSession() can skip the handshake (Deepgram only).
   */
  armSession?: () => Promise<SessionStartResult>
  startSession: () => Promise<SessionStartResult>
  stopSession: () => void
  /** Clears interimText, confirmedWords, fillerCount, and resets internal refs. */
  reset: () => void
  /**
   * Register a callback fired when VAD detects the start of speech.
   * Fires within ~32ms of the first phoneme (Deepgram path only).
   * WebSpeech implementation is a no-op.
   */
  onSpeechStart?: (handler: (ts: number) => void) => void
  /**
   * Register a callback fired when VAD detects the end of speech.
   * WebSpeech implementation is a no-op.
   */
  onSpeechEnd?: (handler: (ts: number) => void) => void
}

export type SpeechProvider = SpeechProviderState & SpeechProviderActions

export type ProviderType = 'webspeech' | 'deepgram'

/** Result of armSession / startSession — error is set when ok is false. */
export type SessionStartResult =
  | { ok: true }
  | { ok: false; error: string }
