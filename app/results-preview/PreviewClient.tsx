'use client'

import SpeedResultsView from '@/components/game/SpeedResultsView'
import type { SessionTimeline } from '@/store/testStore'

const YOU = [4, 9, 14, 17, 20, 24, 29, 33, 37, 42, 48, 52, 56, 63, 69, 74]
const RAW = [8, 16, 24, 30, 37, 44, 52, 60, 68, 76, 80, 82, 84, 88, 90, 92]
const MOMENTUM = [5, 11, 18, 24, 27, 31, 40, 50, 54, 56, 58, 66, 72, 78, 82, 84]
const ERR_SECS = [4, 6, 8, 14, 18, 24]

const timeline: SessionTimeline = {
  wpm: YOU.map((v, i) => ({ second: i * 2, wpm: v })),
  raw: RAW.map((v, i) => ({ second: i * 2, wpm: v })),
  momentum: MOMENTUM.map((v, i) => ({ second: i * 2, value: v })),
  errors: ERR_SECS.map((s) => ({ second: s, wpm: 0 })),
  wordWindows: [
    { startSecond: 2, endSecond: 5, label: 'steady start' },
    { startSecond: 12, endSecond: 16, label: 'nice momentum' },
    { startSecond: 26, endSecond: 30, label: 'great finish' },
  ],
}

const noop = () => {}

export default function PreviewClient() {
  return (
    <div data-theme="latte">
      <SpeedResultsView
        netWpm={78}
        rawWpm={112}
        accuracy={40}
        consistency={57}
        fillerCount={0}
        wordsSpoken={60}
        deltaWpm={78}
        isPersonalBest
        correct={36}
        wrong={15}
        missed={39}
        total={90}
        timeline={timeline}
        durationSec={30}
        streakDays={1}
        promptType="sentences"
        onRetry={noop}
        onNext={noop}
        onPractice={noop}
        onShare={noop}
        onHistory={noop}
      />
    </div>
  )
}
