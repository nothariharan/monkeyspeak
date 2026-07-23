import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { diffWords, calcClarityScore, calcPunctuationScore } from '@/lib/diff'
import type { ClarityLeaderboardRow, ClaritySubmission } from './client'

type DbRow = { tool_id: string; tool_name: string; clarity_score: number; punctuation_score: number; run_count: number }

const allowedPromptTypes = new Set(['sentences', 'technical', 'tongue-twisters', 'custom'])

export function validateClaritySubmission(body: unknown): ClaritySubmission | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid benchmark result' }
  const value = body as Record<string, unknown>
  const text = (key: string, max: number) => typeof value[key] === 'string' ? value[key].trim().slice(0, max) : ''
  const toolId = text('toolId', 48).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const toolName = text('toolName', 48)
  const promptType = text('promptType', 32)
  const promptText = text('promptText', 1600)
  const transcript = text('transcript', 6000)

  if (toolId.length < 2 || toolName.length < 2 || !allowedPromptTypes.has(promptType)) {
    return { error: 'invalid tool or prompt' }
  }
  if (promptText.length < 10 || transcript.length < 1) {
    return { error: 'prompt and transcript are required' }
  }

  // Always recompute — never trust client-chosen scores.
  const promptWordCount = promptText.trim().split(/\s+/).filter(Boolean).length
  const diff = diffWords(promptText, transcript)
  const { score: clarityScore } = calcClarityScore(diff, promptWordCount)
  const punctuationScore = calcPunctuationScore(promptText, transcript)

  return {
    toolId,
    toolName,
    promptType,
    promptText,
    transcript,
    clarityScore,
    punctuationScore,
  }
}

export async function fetchClarityLeaderboard(): Promise<ClarityLeaderboardRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('clarity_tool_leaderboard')
    .select('tool_id, tool_name, clarity_score, punctuation_score, run_count')
    .order('clarity_score', { ascending: false })
    .limit(8)

  // Migration not applied yet — treat as an empty board instead of a hard failure.
  if (error) {
    const missing =
      error.code === 'PGRST205' ||
      /clarity_tool_leaderboard|schema cache/i.test(error.message ?? '')
    if (missing) return []
    throw error
  }

  return ((data ?? []) as DbRow[]).map((row) => ({
    toolId: row.tool_id, toolName: row.tool_name, clarityScore: row.clarity_score,
    punctuationScore: row.punctuation_score, runCount: row.run_count,
  }))
}

export async function saveClarityBenchmark(submission: ClaritySubmission) {
  const { error } = await getSupabaseAdmin().from('clarity_benchmark_entries').insert({
    tool_id: submission.toolId, tool_name: submission.toolName, prompt_type: submission.promptType,
    prompt_text: submission.promptText, transcript: submission.transcript,
    clarity_score: submission.clarityScore, punctuation_score: submission.punctuationScore,
  })
  if (error) {
    const missing =
      error.code === 'PGRST205' ||
      /clarity_benchmark_entries|schema cache/i.test(error.message ?? '')
    if (missing) {
      throw new Error('clarity board migration not applied — run supabase/migrations/002_clarity_benchmark.sql')
    }
    throw error
  }
}
