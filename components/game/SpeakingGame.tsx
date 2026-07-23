'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { SpeakingGameState } from '@/hooks/useSpeakingGame'
import { useVoiceActivity } from '@/hooks/useVoiceActivity'
import { useSpeakingMomentum } from '@/hooks/useSpeakingMomentum'
import type { TimelineSample } from '@/lib/stats/timeline'
import GameHUD from '@/components/game/GameHUD'
import DissolveText from '@/components/game/DissolveText'
import VoiceWave from '@/components/game/VoiceWave'
import MonkeyDisplay from '@/components/game/MonkeyDisplay'
import type { ProviderType } from '@/hooks/useSpeechProvider'
import type { EndCondition } from '@/store/testStore'
import { useTestStore } from '@/store/testStore'

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
  waveActivity?: number
  speechActive?: boolean
  game: SpeakingGameState
  timelineRef: MutableRefObject<TimelineSample[]>
  isEnding?: boolean
  activeSource: ProviderType
  isListening: boolean
  sttError?: string | null
  endCondition?: EndCondition
  elapsedMs?: number
  fillerFlashTick?: number
}

export default function SpeakingGame({
  words,
  timeRemainingMs,
  totalDurationMs,
  dissolvedCount,
  micStream,
  waveActivity = 0,
  speechActive = false,
  game,
  timelineRef,
  isEnding = false,
  activeSource,
  isListening,
  sttError,
  endCondition = 'timer',
  elapsedMs = 0,
  fillerFlashTick = 0,
}: SpeakingGameProps) {
  const active = !isEnding
  const settings = useTestStore((s) => s.settings)
  const voice = useVoiceActivity({ micStream, isActive: active, isEnding })
  const energy = micStream ? Math.max(voice.energy, waveActivity * 0.5) : waveActivity
  const isSpeaking = micStream ? voice.isSpeaking || waveActivity > 0.12 : waveActivity > 0.08 || speechActive
  const momentum = useSpeakingMomentum({
    dissolvedCount,
    rawWpms: game.rawWpms,
    isActive: active,
    energy,
    isSpeaking,
  })

  const sampleRef = useRef({
    words,
    dissolvedCount,
    liveWpm: game.liveWpm,
    currentIndex: game.currentIndex,
    momentum,
  })
  sampleRef.current = {
    words,
    dissolvedCount,
    liveWpm: game.liveWpm,
    currentIndex: game.currentIndex,
    momentum,
  }

  // Stable 1s sampler — do not reset when live metrics change.
  useEffect(() => {
    if (!active) return

    let second = 0
    const id = window.setInterval(() => {
      second++
      const snap = sampleRef.current
      timelineRef.current.push({
        second,
        cumulativeChars: cumulativeCharsFromDissolved(snap.words, snap.currentIndex),
        liveWpm: snap.liveWpm,
        momentum: snap.momentum,
        currentIndex: snap.currentIndex,
      })
    }, 1000)

    return () => clearInterval(id)
  }, [active, timelineRef])

  useEffect(() => {
    if (!settings.fillerFlash || !fillerFlashTick) return
    const root = document.documentElement
    root.classList.add('filler-flash')
    const t = window.setTimeout(() => root.classList.remove('filler-flash'), 220)
    return () => clearTimeout(t)
  }, [fillerFlashTick, settings.fillerFlash])

  return (
    <div
      className={`game-focus-mode${settings.blindMode ? ' game-focus-mode--blind' : ''}`}
      role="main"
      aria-label="Speaking test"
    >
      <div className="game-focus-card">
        <GameHUD
          timeRemainingMs={timeRemainingMs}
          totalDurationMs={totalDurationMs}
          momentum={momentum}
          activeSource={activeSource}
          isListening={isListening}
          sttError={sttError}
          hasWords={dissolvedCount > 0}
          endCondition={endCondition}
          elapsedMs={elapsedMs}
          currentIndex={dissolvedCount}
          totalWords={words.length}
        />

        <div className="game-stage">
          <div className="game-reading-zone">
            <DissolveText
              words={words}
              dissolvedCount={dissolvedCount}
              blindMode={settings.blindMode}
              smoothCaret={settings.smoothCaret}
            />
          </div>

          <div className="game-lower-zone">
            <div className="game-monkey-zone">
              <MonkeyDisplay momentum={momentum} isActive={active} />
            </div>

            <div className="game-wave-zone game-wave-zone--bottom">
              <VoiceWave
                stream={micStream}
                isActive={active}
                activityLevel={micStream ? Math.max(voice.energy, waveActivity) : waveActivity}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
