/**
 * Applies supabase/migrations/002_clarity_benchmark.sql via the Supabase
 * Management API. Needs a personal access token (not the service role key):
 *
 *   1. Create one at https://supabase.com/dashboard/account/tokens
 *   2. Run:  $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/apply-clarity-migration.mjs
 *
 * Or: npx supabase login --token sbp_...
 *     npx supabase db query --linked -f supabase/migrations/002_clarity_benchmark.sql
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const token = process.env.SUPABASE_ACCESS_TOKEN
const confirm = process.env.CONFIRM_MIGRATION === '1'

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

if (!PROJECT_REF) {
  console.error('Set SUPABASE_PROJECT_REF (or SUPABASE_URL) before applying migrations.')
  process.exit(1)
}

if (!confirm) {
  console.error(`Refusing to apply without CONFIRM_MIGRATION=1 (target project: ${PROJECT_REF})`)
  process.exit(1)
}

const sql = readFileSync(resolve('supabase/migrations/002_clarity_benchmark.sql'), 'utf8')
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const body = await res.text()
if (!res.ok) {
  console.error(`Migration failed (${res.status}):`, body)
  process.exit(1)
}

console.log('Clarity benchmark migration applied.')
console.log(body.slice(0, 400))
