'use client'

import { useMemo } from 'react'
import { calculateSpeakingStreak, getLocalDateStr } from '@/lib/stats/streak'
import { useTestStore } from '@/store/testStore'

const DAILY_RUN_GOAL = 3

export default function HeroDailyGoal() {
  const speakingActivity = useTestStore((s) => s.settings.speakingActivity)
  const todayRuns = speakingActivity[getLocalDateStr()] ?? 0
  const streak = useMemo(() => calculateSpeakingStreak(speakingActivity), [speakingActivity])
  const progress = Math.min(1, todayRuns / DAILY_RUN_GOAL)

  return (
    <section className="hero-sticky-note hero-sticky-note--goal hero-animate" aria-label="Daily goal">
      <span className="hero-paper-tape hero-paper-tape--blue" aria-hidden />
      <div className="hero-sticky-note-head">
        <span className="hero-sticky-note-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <div>
          <h3>daily goal</h3>
          <p>{Math.min(todayRuns, DAILY_RUN_GOAL)} / {DAILY_RUN_GOAL} runs today</p>
        </div>
      </div>

      <div className="hero-goal-track" aria-hidden>
        {Array.from({ length: DAILY_RUN_GOAL }, (_, index) => (
          <span
            key={index}
            className={`hero-goal-segment${index < todayRuns ? ' hero-goal-segment--done' : ''}`}
          />
        ))}
        <span className="hero-goal-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <p className="hero-sticky-note-foot">
        {streak > 0 ? (
          <>nice streak · {streak} day{streak === 1 ? '' : 's'}</>
        ) : (
          <>complete {DAILY_RUN_GOAL} runs to hit today&apos;s goal</>
        )}
      </p>
    </section>
  )
}
