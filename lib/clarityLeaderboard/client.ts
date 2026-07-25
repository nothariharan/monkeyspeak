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

export type ClarityBoardQuery = {
  /** Server aggregates only entries of this prompt type; omit for the all-prompts board. */
  promptType?: string
  limit?: number
}

export async function fetchClarityLeaderboard(query: ClarityBoardQuery = {}) {
  const params = new URLSearchParams()
  if (query.promptType) params.set('promptType', query.promptType)
  if (query.limit) params.set('limit', String(query.limit))
  const qs = params.toString()
  const response = await fetch(`/api/clarity-benchmark${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
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
