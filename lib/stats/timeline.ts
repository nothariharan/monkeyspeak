import type { DiffWord, SessionTimeline } from '@/store/testStore'
/** per-second samples captured while you yap during a speed run */
export interface TimelineSample {
  second: number
  cumulativeChars: number
  liveWpm: number
  momentum: number
  currentIndex: number
}

function buildWordWindows(
  samples: TimelineSample[],
  windowSize = 10
): { startSecond: number; endSecond: number; label: string }[] {
  if (samples.length < 2) return []
  const maxIndex = Math.max(...samples.map((s) => s.currentIndex))
  if (maxIndex < windowSize) return []

  const lastSec = samples[samples.length - 1]!.second
  const windows: { startSecond: number; endSecond: number; label: string }[] = []

  for (let wStart = 0; wStart < maxIndex; wStart += windowSize) {
    const wEnd = wStart + windowSize
    const startSample = samples.find((s) => s.currentIndex >= wStart)
    const endSample = samples.find((s) => s.currentIndex >= wEnd)
    windows.push({
      startSecond: startSample?.second ?? 0,
      endSecond: endSample?.second ?? lastSec,
      label: `${wStart + 1}–${wEnd}`,
    })
  }

  return windows
}

/** turn live samples into chart series for the results graph */
export function buildSessionTimeline(
  samples: TimelineSample[],
  diff: DiffWord[]
): SessionTimeline | undefined {
  if (samples.length < 2) return undefined

  const raw: { second: number; wpm: number }[] = []
  const wpm: { second: number; wpm: number }[] = []
  const momentum: { second: number; value: number }[] = []
  const progress: { second: number; words: number }[] = []

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!
    wpm.push({ second: s.second, wpm: s.liveWpm })
    momentum.push({ second: s.second, value: s.momentum })
    progress.push({ second: s.second, words: s.currentIndex })

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

  const wordWindows = buildWordWindows(samples)

  return { raw, wpm, momentum, errors, progress, wordWindows }
}

/** if the live sampler barely ran, fake a flat-ish line so the results graph still renders */
export function resolveResultsTimeline(
  timeline: SessionTimeline | undefined,
  netWpm: number,
  rawWpm: number,
  durationSec: number,
  elapsedSec: number
): SessionTimeline {
  if (timeline && timeline.wpm.length > 1) return timeline

  const sec = Math.max(1, Math.round(elapsedSec || durationSec))
  const steps = Math.max(2, Math.min(sec, 10))
  const wpm: { second: number; wpm: number }[] = []
  const net = Math.max(netWpm, 1)

  for (let i = 0; i <= steps; i++) {
    const second = Math.round((sec / steps) * i)
    const t = i / steps
    wpm.push({ second, wpm: Math.round(netWpm * t) })
  }

  const raw = wpm.map((p) => ({
    second: p.second,
    wpm: Math.round((rawWpm / net) * p.wpm),
  }))

  const momentum = wpm.map((p) => ({
    second: p.second,
    value: Math.round(35 + 55 * (p.wpm / net)),
  }))

  return {
    raw,
    wpm,
    momentum,
    errors: timeline?.errors ?? [],
  }
}
