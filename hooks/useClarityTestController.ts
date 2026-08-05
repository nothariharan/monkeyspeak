'use client'

import { useState, useCallback } from 'react'
import { useTestStore } from '@/store/testStore'
import { diffWords, calcClarityScore, calcPunctuationScore } from '@/lib/diff'
import { submitClarityBenchmark } from '@/lib/clarityLeaderboard/client'
import { generateClarityPrompt, type PromptMode } from '@/lib/prompts'
import { splitPrompt } from '@/hooks/useSpeedTestController'

export function useClarityTestController() {
  const [claritySaveError, setClaritySaveError] = useState<string | null>(null)

  const handleClarityStop = useCallback(() => {
    const s = useTestStore.getState()
    const promptStr = s.prompt.join(' ')
    const diff = diffWords(promptStr, s.clarityTranscript)
    const promptWordCount = promptStr.trim().split(/\s+/).filter(Boolean).length
    const { score, grade } = calcClarityScore(diff, promptWordCount)
    const punctuationScore = calcPunctuationScore(promptStr, s.clarityTranscript)
    
    const missedWordsList = diff
      .filter((w) => w.tag === 'missed' || w.tag === 'substituted')
      .map((w) => w.tag === 'substituted' ? (w.expected ?? w.word) : w.word)
      .map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '').trim())
      .filter(Boolean)

    const spokenWordCount = s.clarityTranscript.trim().split(/\s+/).filter(Boolean).length

    s.setDiffResult(diff, score, grade)
    setClaritySaveError(null)
    void submitClarityBenchmark({
      toolId: s.clarityToolId,
      toolName: s.clarityToolName,
      promptType: s.promptType,
      promptText: promptStr,
      transcript: s.clarityTranscript,
      clarityScore: score,
      punctuationScore,
    }).then(() => {
      window.dispatchEvent(new Event('clarity-benchmark:refresh'))
    }).catch((err: unknown) => {
      setClaritySaveError(err instanceof Error ? err.message : 'could not save clarity result')
    })
    const promptMarks = promptStr.match(/[,.!?;:—'"]/g)?.length ?? 0
    s.pushSessionHistory({
      date: new Date().toISOString(),
      mode: 'clarity',
      duration: 0,
      promptType: s.promptType,
      netWpm: 0,
      accuracy: score,
      fillerCount: 0,
      missedWords: missedWordsList,
      consistency: 0,
      wordsSpoken: spokenWordCount || promptWordCount,
      toolName: s.clarityToolName || undefined,
      promptMarks,
    })
    s.setTestState('ended')
  }, [])

  const handleClarityShuffle = useCallback(() => {
    const s = useTestStore.getState()
    if (s.testState !== 'idle') return
    const last = s.prompt.join(' ')
    const text = generateClarityPrompt(s.promptType as PromptMode, s.customPromptText, last)
    s.setPrompt(splitPrompt(text))
  }, [])

  return {
    claritySaveError,
    setClaritySaveError,
    handleClarityStop,
    handleClarityShuffle,
  }
}
