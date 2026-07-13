'use client'

import { LEADERBOARD_DURATIONS, LEADERBOARD_PROMPTS } from '@/components/leaderboard/leaderboardUtils'
import type { Duration, PromptType } from '@/store/testStore'

type LeaderboardFiltersProps = {
  duration: Duration
  promptType: PromptType
  onDurationChange: (duration: Duration) => void
  onPromptTypeChange: (promptType: PromptType) => void
  showPromptTabs?: boolean
}

export default function LeaderboardFilters({
  duration,
  promptType,
  onDurationChange,
  onPromptTypeChange,
  showPromptTabs = true,
}: LeaderboardFiltersProps) {
  return (
    <div className="leaderboard-filters">
      <div className="settings-segment settings-segment--full" role="tablist" aria-label="Leaderboard duration">
        {LEADERBOARD_DURATIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={duration === value}
            className={duration === value ? 'active' : ''}
            onClick={() => onDurationChange(value)}
          >
            {value}s
          </button>
        ))}
      </div>

      {showPromptTabs && (
        <div className="leaderboard-prompt-tabs" role="tablist" aria-label="Leaderboard prompt type">
          {LEADERBOARD_PROMPTS.map((opt) => {
            const active = opt.value === 'daily'
              ? promptType === 'daily' || promptType.startsWith('daily-')
              : promptType === opt.value

            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? 'active' : ''}
                onClick={() => onPromptTypeChange(opt.value)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
