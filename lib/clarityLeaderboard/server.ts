import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { diffWords, calcClarityScore, calcPunctuationScore } from '@/lib/diff'
import type { ClarityLeaderboardRow, ClaritySubmission } from './client'

type DbRow = { tool_id: string; tool_name: string; clarity_score: number; punctuation_score: number; run_count: number }

const allowedPromptTypes = new Set(['sentences', 'technical', 'tongue-twisters', 'custom'])

export function isClarityPromptType(value: string): boolean {
  return allowedPromptTypes.has(value)
}

export type ClarityBoardOptions = {
  promptType?: string
  limit?: number
}

const DEFAULT_BOARD_LIMIT = 8
const MAX_BOARD_LIMIT = 50

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

export async function fetchClarityLeaderboard(options: ClarityBoardOptions = {}): Promise<ClarityLeaderboardRow[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_BOARD_LIMIT), 1), MAX_BOARD_LIMIT)
  if (options.promptType && allowedPromptTypes.has(options.promptType)) {
    return fetchFilteredClarityBoard(options.promptType, limit)
  }

  const { data, error } = await getSupabaseAdmin()
    .from('clarity_tool_leaderboard')
    .select('tool_id, tool_name, clarity_score, punctuation_score, run_count')
    .order('clarity_score', { ascending: false })
    .limit(limit)

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

type EntryRow = { tool_id: string; tool_name: string; clarity_score: number; punctuation_score: number }

/**
 * Prompt-filtered board. PostgREST can't GROUP BY through the JS client, so we
 * pull the raw 30-day entries for the prompt type and aggregate here — same
 * semantics as the clarity_tool_leaderboard view.
 */
async function fetchFilteredClarityBoard(promptType: string, limit: number): Promise<ClarityLeaderboardRow[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await getSupabaseAdmin()
    .from('clarity_benchmark_entries')
    .select('tool_id, tool_name, clarity_score, punctuation_score')
    .eq('prompt_type', promptType)
    .gte('created_at', since)
    .limit(5000)

  if (error) {
    const missing =
      error.code === 'PGRST205' ||
      /clarity_benchmark_entries|schema cache/i.test(error.message ?? '')
    if (missing) return []
    throw error
  }

  const byTool = new Map<string, { toolName: string; claritySum: number; punctuationSum: number; runCount: number }>()
  for (const row of (data ?? []) as EntryRow[]) {
    const agg = byTool.get(row.tool_id) ?? { toolName: row.tool_name, claritySum: 0, punctuationSum: 0, runCount: 0 }
    // match the view's max(tool_name) tie-break for display names
    if (row.tool_name > agg.toolName) agg.toolName = row.tool_name
    agg.claritySum += row.clarity_score
    agg.punctuationSum += row.punctuation_score
    agg.runCount += 1
    byTool.set(row.tool_id, agg)
  }

  return Array.from(byTool.entries())
    .map(([toolId, agg]) => ({
      toolId,
      toolName: agg.toolName,
      clarityScore: Math.round(agg.claritySum / agg.runCount),
      punctuationScore: Math.round(agg.punctuationSum / agg.runCount),
      runCount: agg.runCount,
    }))
    .sort((a, b) =>
      b.clarityScore - a.clarityScore || b.punctuationScore - a.punctuationScore || b.runCount - a.runCount
    )
    .slice(0, limit)
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
