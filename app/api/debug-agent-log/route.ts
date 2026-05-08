import { appendFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

/** NDJSON sink — remove or harden before shipping to untrusted hosting. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const cwd = process.cwd()
    const payload = { ...body, _serverCwd: cwd, _nodeEnv: process.env.NODE_ENV }
    await appendFile(join(cwd, 'debug-1ddc33.log'), `${JSON.stringify(payload)}\n`, 'utf8')
    return NextResponse.json({ ok: true, cwd })
  } catch (e) {
    console.warn('[debug-agent-log] failed:', e)
    return NextResponse.json({ ok: false, err: String(e) }, { status: 500 })
  }
}
