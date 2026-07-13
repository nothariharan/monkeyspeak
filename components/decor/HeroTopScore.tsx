'use client'

import { useTestStore } from '@/store/testStore'

export default function HeroTopScore() {
  const duration = useTestStore((s) => s.duration)
  const promptType = useTestStore((s) => s.promptType)
  const topWpm = useTestStore(
    (s) => s.settings.personalBests[`speed-${duration}s-${promptType}`]?.wpm ?? 0
  )
  const hasScore = topWpm > 0

  return (
    <div
      className="hero-top-score paper-panel hero-animate"
      role="status"
      aria-live="polite"
      aria-label={hasScore ? `Your top score ${topWpm} words per minute` : 'No top score yet'}
    >
      <span className="hero-paper-tape hero-paper-tape--orange" aria-hidden />
      <span className="momentum-fire-label">top score</span>
      <span className="hero-top-score-duration">{duration}s</span>
      <div className="hero-top-score-core">
        <span className="hero-top-score-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 11v5M8 20h8M10 16h4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="hero-top-score-value tabular-nums">{hasScore ? topWpm : '--'}</span>
      </div>
      <span className="hero-top-score-foot">
        {hasScore ? 'keep it going!' : 'go for your first run'}
      </span>
    </div>
  )
}
