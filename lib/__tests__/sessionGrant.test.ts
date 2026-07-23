import { issueSessionGrant, verifySessionGrant } from '../security/sessionGrant'

describe('sessionGrant', () => {
  it('issues and verifies a deepgram session', () => {
    const token = issueSessionGrant('deepgram', { duration: 30, ttlMs: 60_000 })
    const result = verifySessionGrant(token, 'deepgram', { duration: 30 })
    expect(result.ok).toBe(true)
  })

  it('rejects wrong purpose', () => {
    const token = issueSessionGrant('run', { duration: 30, promptType: 'sentences' })
    const result = verifySessionGrant(token, 'deepgram')
    expect(result.ok).toBe(false)
  })

  it('rejects tampered tokens', () => {
    const token = issueSessionGrant('deepgram', { duration: 15 })
    const result = verifySessionGrant(token.slice(0, -2) + 'aa', 'deepgram')
    expect(result.ok).toBe(false)
  })
})
