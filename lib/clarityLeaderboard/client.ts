export type ClarityLeaderboardRow = {
  toolId: string
  toolName: string
  clarityScore: number
  punctuationScore: number
  runCount: number
}

export type ClaritySubmission = {
  toolId: string
  toolName: string
  promptType: string
  promptText: string
  transcript: string
  clarityScore: number
  punctuationScore: number
}

async function readResponse(response: Response) {
  const raw = await response.text()
  try { return raw ? JSON.parse(raw) as { rows?: ClarityLeaderboardRow[]; error?: string } : {} }
  catch { throw new Error('clarity benchmark is unavailable') }
}

export async function fetchClarityLeaderboard() {
  const response = await fetch('/api/clarity-benchmark', { cache: 'no-store' })
  const data = await readResponse(response)
  if (!response.ok) throw new Error(data.error ?? 'could not load clarity board')
  return data.rows ?? []
}

export async function submitClarityBenchmark(submission: ClaritySubmission) {
  const response = await fetch('/api/clarity-benchmark', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  })
  const data = await readResponse(response)
  if (!response.ok) throw new Error(data.error ?? 'could not save benchmark result')
}
