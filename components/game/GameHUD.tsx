'use client'

import MomentumFire from '@/components/game/MomentumFire'
import TimeProgressBar from '@/components/game/TimeProgressBar'
import PassageProgressBar from '@/components/game/PassageProgressBar'
import SttStatusBadge from '@/components/game/SttStatusBadge'
import type { ProviderType } from '@/hooks/useSpeechProvider'
import type { EndCondition } from '@/store/testStore'

interface GameHUDProps {
  timeRemainingMs: number
  totalDurationMs: number
  momentum: number
  activeSource: ProviderType
  isListening: boolean
  sttError?: string | null
  hasWords: boolean
  endCondition?: EndCondition
  elapsedMs?: number
  currentIndex?: number
  totalWords?: number
}

export default function GameHUD({
  timeRemainingMs,
  totalDurationMs,
  momentum,
  activeSource,
  isListening,
  sttError,
  hasWords,
  endCondition = 'timer',
  elapsedMs = 0,
  currentIndex = 0,
  totalWords = 0,
}: GameHUDProps) {
  return (
    <header className="game-header-row" role="status" aria-live="polite" aria-label="Live test statistics">
      {endCondition === 'passage' ? (
        <PassageProgressBar
          elapsedMs={elapsedMs}
          currentIndex={currentIndex}
          totalWords={totalWords}
        />
      ) : (
        <TimeProgressBar
          timeRemainingMs={timeRemainingMs}
          totalDurationMs={totalDurationMs}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <SttStatusBadge
          activeSource={activeSource}
          isListening={isListening}
          sttError={sttError}
          hasWords={hasWords}
        />
        <MomentumFire momentum={momentum} />
      </div>
    </header>
  )
}
