'use client'

import { useCallback, useState } from 'react'
import { diffWords, calcClarityScore } from '@/lib/diff'
import type { DiffWord } from '@/store/testStore'

interface UseDiffReturn {
  run: (prompt: string, transcript: string) => void
  result: DiffWord[]
  score: number
  grade: 'S' | 'A' | 'B' | 'C' | 'needs work'
  promptWordCount: number
}

export function useDiff(): UseDiffReturn {
  const [result, setResult]               = useState<DiffWord[]>([])
  const [score, setScore]                 = useState(0)
  const [grade, setGrade]                 = useState<'S' | 'A' | 'B' | 'C' | 'needs work'>('needs work')
  const [promptWordCount, setPromptWordCount] = useState(0)

  const run = useCallback((prompt: string, transcript: string) => {
    const diff = diffWords(prompt, transcript)
    const promptWords = prompt.trim().split(/\s+/).filter(Boolean).length
    const { score: s, grade: g } = calcClarityScore(diff, promptWords)

    setResult(diff)
    setScore(s)
    setGrade(g)
    setPromptWordCount(promptWords)
  }, [])

  return { run, result, score, grade, promptWordCount }
}
