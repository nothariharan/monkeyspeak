import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard - MonkeySpeak',
  description: 'Global speaking rankings and your local stats in one place.',
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
