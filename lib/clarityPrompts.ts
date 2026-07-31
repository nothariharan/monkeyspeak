export type ClarityPromptScene =
  | 'office'
  | 'clinic'
  | 'travel'
  | 'support'
  | 'tech'
  | 'twister'

export type ClaritySignal = 'names' | 'numbers' | 'punctuation' | 'pauses'

export type ClarityBankMode = 'sentences' | 'technical' | 'tongue-twisters'

export type ClarityPromptEntry = {
  id: string
  mode: ClarityBankMode
  scene: ClarityPromptScene
  text: string
  signals: ClaritySignal[]
}

export const CLARITY_PROMPT_BANK: ClarityPromptEntry[] = [
  // ── sentences (~12) ──────────────────────────────────────────────
  {
    id: 'sent-office-01',
    mode: 'sentences',
    scene: 'office',
    text: 'Before you leave, please check the blue folder, the 4:30 calendar invite, and the note marked “final draft.” If anything is unclear, ask: “Should we revise it now, or wait until tomorrow?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-office-02',
    mode: 'sentences',
    scene: 'office',
    text: 'Can you ping Jordan at 11:15 a.m. and confirm the slide deck titled “Q2 wrap”? Reply with: “Looks good,” or “Needs one more pass,” before noon.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-office-03',
    mode: 'sentences',
    scene: 'office',
    text: 'Move the standup to 9:05 sharp; add Priya, Omar, and “guest: legal.” Leave a sticky that says: “Do not share outside the team.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-office-04',
    mode: 'sentences',
    scene: 'office',
    text: 'File this under Project Atlas — budget line 7B, owner: Sam. If costs exceed $2,400, pause and ask: “Approve the overrun?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-clinic-01',
    mode: 'sentences',
    scene: 'clinic',
    text: 'Nurse Patel noted: “Patient L-09, pulse 72, oxygen 98%.” Give 0.5 mg at 6:00 p.m., then recheck in 30 minutes — not sooner.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-clinic-02',
    mode: 'sentences',
    scene: 'clinic',
    text: 'Ask Mrs. O’Reilly: “Any allergy to ibuprofen or penicillin?” Record temperature as 37.2°C and mark the chart “follow-up Friday.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-travel-01',
    mode: 'sentences',
    scene: 'travel',
    text: 'Flight AA-214 boards at Gate C7 by 14:05; bags tagged “fragile.” Tell Ruiz: “We’ll meet at baggage claim, carousel 3.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-travel-02',
    mode: 'sentences',
    scene: 'travel',
    text: 'Train to São Paulo leaves platform 2 at 08:40; seat 14A. Confirm the hotel code is “NORD-77,” then text: “Arrived safe.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-support-01',
    mode: 'sentences',
    scene: 'support',
    text: 'Ticket #4821 from mia@brightmail.com says: “Login fails after 3 tries.” Reply: “Reset sent — check spam by 5:00 p.m.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-support-02',
    mode: 'sentences',
    scene: 'support',
    text: 'Escalate case Z-19 to Tier 2; note: “Customer asked for a 15% credit.” Call back at 2:45 and ask: “Is that acceptable?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-office-05',
    mode: 'sentences',
    scene: 'office',
    text: 'Print two copies of Form 1099, initial page 3, and leave them on Elena’s desk by 5:15. Sticky note: “Sign before Friday’s audit.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'sent-travel-03',
    mode: 'sentences',
    scene: 'travel',
    text: 'Rental pickup is Lot B, stall 12 — keys in locker “K-4.” Ask the desk: “Is the 6:20 shuttle still running to downtown?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },

  // ── technical (~10) ──────────────────────────────────────────────
  {
    id: 'tech-01',
    mode: 'technical',
    scene: 'tech',
    text: 'At 9:45 a.m., Maya confirmed that the API v2.1 rollout is 87% complete; however, the EU-West fallback still needs a 30-minute smoke test. “Ship only after the checksum matches,” she said.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-02',
    mode: 'technical',
    scene: 'tech',
    text: 'Please send the Q3 forecast to dev-team@northstar.io, then tag it: priority-high, owner: Priya, and budget: $48,750. If the total changes by more than 2.5%, call me first!',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-03',
    mode: 'technical',
    scene: 'clinic',
    text: 'Dr. Chen’s note reads: “Patient B-14 has a temperature of 38.6°C, takes 0.25 mg daily, and reports no allergy to amoxicillin.” Double-check every decimal before saving.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-04',
    mode: 'technical',
    scene: 'travel',
    text: 'For the launch, pronounce “Nguyễn,” “O’Malley,” and “São Paulo” carefully. The meeting begins at 08:05 IST on Tuesday, July 21st, not Thursday, July 31st.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-05',
    mode: 'technical',
    scene: 'tech',
    text: 'Deploy build 1.4.9 to staging; env key is “DG_PROXY_V3.” If latency exceeds 120 ms, roll back and page on-call: “Incident open.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-06',
    mode: 'technical',
    scene: 'tech',
    text: 'Webhook URL: https://hooks.acme.io/v1/events — secret ends in …7f2a. Retry up to 3 times; log status as “failed” after 45 seconds.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-07',
    mode: 'technical',
    scene: 'tech',
    text: 'Schema change: rename column user_id → account_uuid; migrate 2.3M rows overnight. Slack ops: “Migration window 01:00–03:30 UTC.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-08',
    mode: 'technical',
    scene: 'support',
    text: 'Invoice INV-8842 totals $1,299.50 plus 8.25% tax. Email finance@ledger.co with subject: “Net-30 — please confirm receipt.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-09',
    mode: 'technical',
    scene: 'tech',
    text: 'Feature flag “beta_voice_v2” is on for 12% of users; kill switch is CTRL+SHIFT+K. Ask Kai: “Any spike in 5xx after 16:00?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'tech-10',
    mode: 'technical',
    scene: 'tech',
    text: 'Rotate the JWT secret by Friday 17:00; document in RFC-221. Commit message: “chore: rotate auth keys — no downtime expected.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },

  // ── tongue-twisters (~8) ─────────────────────────────────────────
  {
    id: 'twist-01',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Six sleek switches switched silently; then, surprisingly, the system said: “success, success, success!” At 6:06, Sasha shipped six samples to Sheffield.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-02',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'She sells sea shells; Shannon ships shiny sheets. Say slowly: “sixty-six sharp shards.” Meet at stall 6 by 16:06 sharp!',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-03',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Red leather, yellow leather — recite thrice, then ask: “Ready, Rory?” Timestamp the take as 3:33 p.m., take number 3.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-04',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Unique New York; unique, unique New York. Whisper: “You need New York, June.” Capture clip NX-09 before 9:09 a.m.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-05',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Fuzzy Wuzzy was a bear; Fuzzy Wuzzy wasn’t fuzzy, was he? Mark take “FW-2,” then shout: “Cut — print it!” at 2:22.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-06',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Peter Piper picked a peck; please package peppers promptly. Label: “PP-11 — spicy.” Ship by 11:11 or say: “Postpone.”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-07',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Fresh fried fish; fish fried fresh. Ask Chef Cruz: “Is the special still $15.50?” Seat seven at table 17 by 7:17.',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
  {
    id: 'twist-08',
    mode: 'tongue-twisters',
    scene: 'twister',
    text: 'Irish wristwatch; Swiss wristwatch — switch which watch. Note: “SW-8.” Replay at 8:08 and say: “Which watch switched?”',
    signals: ['names', 'numbers', 'punctuation', 'pauses'],
  },
]

const BY_MODE: Record<ClarityBankMode, ClarityPromptEntry[]> = {
  sentences: CLARITY_PROMPT_BANK.filter((e) => e.mode === 'sentences'),
  technical: CLARITY_PROMPT_BANK.filter((e) => e.mode === 'technical'),
  'tongue-twisters': CLARITY_PROMPT_BANK.filter((e) => e.mode === 'tongue-twisters'),
}

const BY_TEXT = new Map(CLARITY_PROMPT_BANK.map((e) => [e.text, e]))

export function isClarityBankMode(mode: string): mode is ClarityBankMode {
  return mode === 'sentences' || mode === 'technical' || mode === 'tongue-twisters'
}

export function getClarityBank(mode: ClarityBankMode): ClarityPromptEntry[] {
  return BY_MODE[mode]
}

export function pickClarityPrompt(
  mode: ClarityBankMode,
  lastText?: string
): ClarityPromptEntry {
  const bank = BY_MODE[mode]
  if (bank.length === 0) {
    throw new Error(`No clarity prompts for mode: ${mode}`)
  }
  if (bank.length === 1) return bank[0]!

  for (let attempt = 0; attempt < 8; attempt++) {
    const entry = bank[Math.floor(Math.random() * bank.length)]!
    if (!lastText || entry.text !== lastText) return entry
  }
  return bank.find((e) => e.text !== lastText) ?? bank[0]!
}

export function getClarityPromptMeta(text: string): ClarityPromptEntry | null {
  const exact = BY_TEXT.get(text)
  if (exact) return exact
  const trimmed = text.trim()
  return BY_TEXT.get(trimmed) ?? null
}
