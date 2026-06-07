'use client'

import type { SpeakingGameState } from '@/hooks/useSpeakingGame'
import { useVoiceActivity } from '@/hooks/useVoiceActivity'
import { useSpeakingMomentum } from '@/hooks/useSpeakingMomentum'
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
}

export default function SpeakingGame({
  words,
  timeRemainingMs,
  dissolvedCount,
  micStream,
  game,
  isEnding = false,
}: SpeakingGameProps) {
  const active = !isEnding
  const voice = useVoiceActivity({ micStream, isActive: active, isEnding })
  const momentum = useSpeakingMomentum({
    dissolvedCount,
    rawWpms: game.rawWpms,
    isActive: active,
  })

  return (
    <div className="game-focus-mode" role="main" aria-label="Speaking test">
      <AmbientEnvironment energy={voice.energy} />

      <div className="game-focus-card">
        <div className="game-focus-content">
          <GameHUD timeRemainingMs={timeRemainingMs} momentum={momentum} />

          <div className="game-wave-zone game-wave-zone--top">
            <VoiceWave stream={micStream} isActive={active} />
          </div>

          <div className="game-reading-zone">
            <DissolveText words={words} dissolvedCount={dissolvedCount} />
          </div>

          <div className="game-monkey-zone">
            <MonkeyDisplay momentum={momentum} isActive={active} />
          </div>
        </div>
      </div>
    </div>
  )
}
