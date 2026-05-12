import { appendFile } from 'fs/promises'
import path from 'path'

/** Append one NDJSON line for session b9a7e7 (not matched by debug-*.log). */
export async function appendTraceB9(payload: Record<string, unknown>): Promise<void> {
  if (payload.sessionId !== 'b9a7e7') return
  const file = path.join(process.cwd(), 'trace-b9a7e7.ndjson')
  await appendFile(file, `${JSON.stringify(payload)}\n`, 'utf8')
}
