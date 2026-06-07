'use client'

import { useEffect, useRef } from 'react'
import type { SpeakingGameState } from '@/hooks/useSpeakingGame'
import { useVoiceActivity } from '@/hooks/useVoiceActivity'
import GameHUD from '@/components/game/GameHUD'
import DissolveText from '@/components/game/DissolveText'
import AmbientEnvironment from '@/components/game/AmbientEnvironment'
import VoiceWave from '@/components/game/VoiceWave'
import MonkeyDisplay from '@/components/game/MonkeyDisplay'

interface SpeakingGameProps {
  words: string[]
  timeRemainingMs: number
  dissolvedCount: number
  micStream: MediaStream | null
  game: SpeakingGameState
  isEnding?: boolean
  onPeakMomentum?: (peak: number) => void
}

export default function SpeakingGame({
  words,
  timeRemainingMs,
  dissolvedCount,
  micStream,
  game,
  isEnding = false,
  onPeakMomentum,
}: SpeakingGameProps) {
  const peakMomentumRef = useRef(0)
  const voice = useVoiceActivity({
    micStream,
    isActive: !isEnding,
    isEnding,
  })

  useEffect(() => {
    if (voice.momentum <= peakMomentumRef.current) return
    peakMomentumRef.current = voice.momentum
    onPeakMomentum?.(voice.momentum)
  }, [voice.momentum, onPeakMomentum])

  return (
    <div className="game-focus-mode" role="main" aria-label="Speaking test">
      <AmbientEnvironment momentum={voice.momentum} energy={voice.energy} />

      <div className="game-focus-card">
        <div className="game-focus-content">
          <GameHUD
            wpm={game.liveWpm}
            timeRemainingMs={timeRemainingMs}
            momentum={voice.momentum}
          />

          <div className="game-wave-zone game-wave-zone--top">
            <VoiceWave
              stream={micStream}
              isActive={!isEnding}
            />
          </div>

          <div className="game-reading-zone">
            <DissolveText words={words} dissolvedCount={dissolvedCount} />
          </div>

          <div className="game-monkey-zone">
            <MonkeyDisplay
              liveWpm={game.liveWpm}
              momentum={voice.momentum}
              companionState={voice.companionState}
              isActive={!isEnding}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
