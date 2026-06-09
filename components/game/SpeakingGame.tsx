'use client'

import { useEffect, type MutableRefObject } from 'react'
import type { SpeakingGameState } from '@/hooks/useSpeakingGame'
import { useVoiceActivity } from '@/hooks/useVoiceActivity'
import { useSpeakingMomentum } from '@/hooks/useSpeakingMomentum'
import type { TimelineSample } from '@/lib/stats/timeline'
import GameHUD from '@/components/game/GameHUD'
import DissolveText from '@/components/game/DissolveText'
import VoiceWave from '@/components/game/VoiceWave'
import MonkeyDisplay from '@/components/game/MonkeyDisplay'

function cumulativeCharsFromDissolved(words: string[], dissolvedCount: number): number {
  let chars = 0
  for (let i = 0; i < dissolvedCount && i < words.length; i++) {
    chars += words[i]!.length + 1
  }
  return chars
}

interface SpeakingGameProps {
  words: string[]
  timeRemainingMs: number
  totalDurationMs: number
  dissolvedCount: number
  micStream: MediaStream | null
  game: SpeakingGameState
  timelineRef: MutableRefObject<TimelineSample[]>
  isEnding?: boolean
  interimText?: string
  showLiveTranscript?: boolean
  sttError?: string | null
  sttProvider?: string
  heardWordCount?: number
}

export default function SpeakingGame({
  words,
  timeRemainingMs,
  totalDurationMs,
  dissolvedCount,
  micStream,
  game,
  timelineRef,
  isEnding = false,
  interimText = '',
  showLiveTranscript = true,
  sttError = null,
  sttProvider = 'webspeech',
  heardWordCount = 0,
}: SpeakingGameProps) {
  const active = !isEnding
  const voice = useVoiceActivity({ micStream, isActive: active, isEnding })
  const momentum = useSpeakingMomentum({
    dissolvedCount,
    rawWpms: game.rawWpms,
    isActive: active,
    energy: voice.energy,
    isSpeaking: voice.isSpeaking,
  })

  useEffect(() => {
    if (!active) return

    let second = 0
    const id = window.setInterval(() => {
      second++
      timelineRef.current.push({
        second,
        cumulativeChars: cumulativeCharsFromDissolved(words, dissolvedCount),
        liveWpm: game.liveWpm,
        momentum,
        currentIndex: game.currentIndex,
      })
    }, 1000)

    return () => clearInterval(id)
  }, [active, words, dissolvedCount, game.liveWpm, game.currentIndex, momentum, timelineRef])

  return (
    <div className="game-focus-mode" role="main" aria-label="Speaking test">
      <div className="game-focus-card">
        <GameHUD
          timeRemainingMs={timeRemainingMs}
          totalDurationMs={totalDurationMs}
          momentum={momentum}
        />

        <div className="game-stage">
          <div className="game-reading-zone">
            <DissolveText words={words} dissolvedCount={dissolvedCount} />
            {(showLiveTranscript || sttError) && (
              <div
                className="game-live-transcript font-mono"
                role="status"
                aria-live="polite"
                style={{
                  marginTop: '1rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  border: '2px solid var(--border)',
                  background: 'color-mix(in srgb, var(--surface) 92%, var(--accent) 8%)',
                  color: sttError ? 'var(--error)' : 'var(--text-stats)',
                  fontSize: '0.82rem',
                  minHeight: '2.4rem',
                  textAlign: 'center',
                }}
              >
                {sttError ? (
                  sttError
                ) : interimText.trim() ? (
                  interimText
                ) : heardWordCount > 0 ? (
                  `${heardWordCount} word${heardWordCount === 1 ? '' : 's'} heard`
                ) : (
                  `Listening (${sttProvider === 'deepgram' ? 'Deepgram' : 'browser STT'})… speak the highlighted word`
                )}
              </div>
            )}
          </div>

          <div className="game-lower-zone">
            <div className="game-monkey-zone">
              <MonkeyDisplay momentum={momentum} isActive={active} />
            </div>

            <div className="game-wave-zone game-wave-zone--bottom">
              <VoiceWave stream={micStream} isActive={active} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
