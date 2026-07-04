export function getLocalDateStr(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateSpeakingStreak(speakingActivity: Record<string, number>): number {
  if (!speakingActivity) return 0
  let streak = 0
  
  const todayStr = getLocalDateStr()
  
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const y = yesterday.getFullYear()
  const m = String(yesterday.getMonth() + 1).padStart(2, '0')
  const d = String(yesterday.getDate()).padStart(2, '0')
  const yesterdayStr = `${y}-${m}-${d}`

  // Check if today or yesterday has a run
  let checkDate = new Date()
  let checkStr = todayStr
  
  if (!(speakingActivity[checkStr] > 0)) {
    checkDate = yesterday
    checkStr = yesterdayStr
  }

  while (speakingActivity[checkStr] > 0) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
    const yearIter = checkDate.getFullYear()
    const monthIter = String(checkDate.getMonth() + 1).padStart(2, '0')
    const dayIter = String(checkDate.getDate()).padStart(2, '0')
    checkStr = `${yearIter}-${monthIter}-${dayIter}`
  }

  return streak
}
