import { stripFillers } from '../fillers'
import { alignTranscriptToPrompt, countFillers } from '../alignTranscriptToPrompt'

describe('stripFillers keeps prompt content words', () => {
  it('keeps "so" when it is the next prompt word', () => {
    const { kept, fillerCount } = stripFillers(['so', 'what', 'now'], ['so', 'what', 'now'])
    expect(kept).toEqual(['so', 'what', 'now'])
    expect(fillerCount).toBe(0)
  })

  it('strips "um" and phrase fillers that are not in the prompt', () => {
    const { kept, fillerCount } = stripFillers(
      ['um', 'the', 'you', 'know', 'quick', 'fox'],
      ['the', 'quick', 'fox']
    )
    expect(kept).toEqual(['the', 'quick', 'fox'])
    expect(fillerCount).toBe(2)
  })

  it('aligns when filler-looking prompt words are spoken', () => {
    const result = alignTranscriptToPrompt('so right actually', ['so', 'right', 'actually'])
    expect(result.every((w) => w.tag === 'correct')).toBe(true)
    expect(countFillers('so right actually', ['so', 'right', 'actually'])).toBe(0)
  })

  it('countFillers matches stripFillers', () => {
    expect(countFillers('um the quick fox', ['the', 'quick', 'fox'])).toBe(1)
  })
})
