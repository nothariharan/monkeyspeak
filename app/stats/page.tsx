import { permanentRedirect } from 'next/navigation'

export default function StatsPage() {
  permanentRedirect('/leaderboard#stats')
}
