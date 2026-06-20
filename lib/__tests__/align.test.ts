import { alignTranscriptToPrompt, countFillers } from '../alignTranscriptToPrompt'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tags(result: ReturnType<typeof alignTranscriptToPrompt>) {
  return result.map((w) => w.tag)
}

function words(result: ReturnType<typeof alignTranscriptToPrompt>) {
  return result.map((w) => w.word)
}

// ─── Heavy filler ─────────────────────────────────────────────────────────────

describe('heavy filler input', () => {
  const prompt = ['the', 'quick', 'brown', 'fox']
  const transcript = 'um the um quick brown um fox'

  it('all prompt words align as correct', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    expect(tags(result)).toEqual(['correct', 'correct', 'correct', 'correct'])
  })

  it('counts 3 filler words', () => {
    expect(countFillers(transcript)).toBe(3)
  })
})

// ─── Repeated words ───────────────────────────────────────────────────────────

describe('repeated word in transcript', () => {
  const prompt = ['the', 'quick', 'brown', 'fox']
  const transcript = 'the the quick brown fox'

  it('all prompt words still align as correct', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    expect(tags(result)).toEqual(['correct', 'correct', 'correct', 'correct'])
  })

  it('returns 4 entries (one per prompt word)', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    expect(result).toHaveLength(4)
  })
})

// ─── Skipped segment ──────────────────────────────────────────────────────────

describe('skipped first half of prompt', () => {
  const prompt = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
  // Only speak the second half
  const transcript = 'delta epsilon zeta'

  it('first half is missed', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    const missedWords = result.filter((w) => w.tag === 'missed').map((w) => w.word)
    expect(missedWords).toContain('alpha')
    expect(missedWords).toContain('beta')
    expect(missedWords).toContain('gamma')
  })

  it('second half is correct', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    const correctWords = result.filter((w) => w.tag === 'correct').map((w) => w.word)
    expect(correctWords).toContain('delta')
    expect(correctWords).toContain('epsilon')
    expect(correctWords).toContain('zeta')
  })
})

// ─── Phonetic near-miss ───────────────────────────────────────────────────────

describe('phonetic variants count as correct', () => {
  it('colour matches color', () => {
    const result = alignTranscriptToPrompt('colour', ['color'])
    expect(result[0]?.tag).toBe('correct')
  })

  it('wright matches right (homophones)', () => {
    const result = alignTranscriptToPrompt('wright', ['right'])
    // double metaphone: both map to RT
    expect(result[0]?.tag).toBe('correct')
  })

  // Levenshtein-1 near-misses are intentionally "substituted" not "correct":
  // the aligner uses score >= 2 as the correct threshold, and Levenshtein gives
  // score = 1 which falls below it. This means ASR typos are penalised.
  // Phonetic matches (score = 2) are the closest "free" tier.
  it('presentaion vs presentation is substituted (Lev=1, below correct threshold)', () => {
    const result = alignTranscriptToPrompt('presentaion', ['presentation'])
    expect(result[0]?.tag).toBe('substituted')
  })
})

// ─── Self-correction ──────────────────────────────────────────────────────────

describe('self-correction: extra word inserted mid-sentence', () => {
  const prompt = ['the', 'quick', 'brown', 'fox']
  // speaker says "wait" then continues correctly
  const transcript = 'the quick wait brown fox'

  it('words after the correction still align correctly', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    const correct = result.filter((w) => w.tag === 'correct').map((w) => w.word)
    expect(correct).toContain('the')
    expect(correct).toContain('quick')
    expect(correct).toContain('brown')
    expect(correct).toContain('fox')
  })

  it('all 4 prompt words accounted for (none missed)', () => {
    const result = alignTranscriptToPrompt(transcript, prompt)
    const missed = result.filter((w) => w.tag === 'missed')
    expect(missed).toHaveLength(0)
  })
})

// ─── Empty transcript ─────────────────────────────────────────────────────────

describe('empty or whitespace-only transcript', () => {
  const prompt = ['hello', 'world']

  it('all prompt words are missed when transcript is empty', () => {
    const result = alignTranscriptToPrompt('', prompt)
    expect(tags(result)).toEqual(['missed', 'missed'])
  })

  it('all prompt words are missed when transcript is whitespace only', () => {
    const result = alignTranscriptToPrompt('   ', prompt)
    expect(tags(result)).toEqual(['missed', 'missed'])
  })
})

// ─── Filler-only transcript ───────────────────────────────────────────────────

describe('transcript that is all fillers', () => {
  const prompt = ['hello', 'world']

  it('all prompt words are missed', () => {
    const result = alignTranscriptToPrompt('um uh like so basically', prompt)
    expect(tags(result)).toEqual(['missed', 'missed'])
  })
})

// ─── Long prompt with scattered coverage ─────────────────────────────────────

describe('long prompt with sparse coverage', () => {
  const prompt = 'the quick brown fox jumps over the lazy dog'.split(' ')

  it('exact spoken words are correct', () => {
    // speak only every other word
    const transcript = 'the brown fox over lazy'
    const result = alignTranscriptToPrompt(transcript, prompt)
    const correct = result.filter((w) => w.tag === 'correct').map((w) => w.word)
    expect(correct).toContain('the')
    expect(correct).toContain('brown')
    expect(correct).toContain('fox')
  })

  it('unspoken words are missed not substituted', () => {
    const transcript = 'the quick brown fox'
    const result = alignTranscriptToPrompt(transcript, prompt)
    const missedWords = result.filter((w) => w.tag === 'missed').map((w) => w.word)
    // trailing words not spoken = missed
    expect(missedWords).toContain('jumps')
    expect(missedWords).toContain('over')
    expect(missedWords).toContain('lazy')
    expect(missedWords).toContain('dog')
  })
})

// ─── Case insensitivity ───────────────────────────────────────────────────────

describe('case insensitivity', () => {
  it('UPPERCASE transcript matches lowercase prompt', () => {
    const result = alignTranscriptToPrompt('THE QUICK BROWN FOX', ['the', 'quick', 'brown', 'fox'])
    expect(tags(result)).toEqual(['correct', 'correct', 'correct', 'correct'])
  })
})
