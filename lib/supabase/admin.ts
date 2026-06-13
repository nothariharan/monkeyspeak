import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (admin) return admin

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('supabase env missing — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  // service role — server only
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return admin
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
