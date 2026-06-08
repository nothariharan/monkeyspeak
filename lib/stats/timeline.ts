import type { DiffWord, SessionTimeline } from '@/store/testStore'

/** Raw per-second sample captured during a live session. */
export interface TimelineSample {
  second: number
  cumulativeChars: number
  liveWpm: number
  momentum: number
  currentIndex: number
}

/** Derive MonkeyType-style chart series from captured timeline samples. */
export function buildSessionTimeline(
  samples: TimelineSample[],
  diff: DiffWord[]
): SessionTimeline | undefined {
  if (samples.length < 2) return undefined

  const raw: { second: number; wpm: number }[] = []
  const wpm: { second: number; wpm: number }[] = []
  const momentum: { second: number; value: number }[] = []

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!
    wpm.push({ second: s.second, wpm: s.liveWpm })
    momentum.push({ second: s.second, value: s.momentum })

    if (i === 0) {
      raw.push({ second: s.second, wpm: Math.round((s.cumulativeChars / 5) * 60) })
    } else {
      const prev = samples[i - 1]!
      const deltaChars = Math.max(0, s.cumulativeChars - prev.cumulativeChars)
      raw.push({ second: s.second, wpm: Math.round((deltaChars / 5) * 60) })
    }
  }

  const errors: { second: number; wpm: number }[] = []
  let promptIdx = 0
  for (const entry of diff) {
    if (entry.tag === 'substituted' || entry.tag === 'missed') {
      const targetIdx = promptIdx
      const sample = samples.find((s) => s.currentIndex >= targetIdx)
      if (sample) {
        errors.push({ second: sample.second, wpm: sample.liveWpm })
      }
    }
    if (entry.tag !== 'added') promptIdx++
  }

  return { raw, wpm, momentum, errors }
}
