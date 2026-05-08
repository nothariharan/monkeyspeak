import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

const SESSION_LOG = 'debug-26db2b.log'

/**
 * Writes one NDJSON line for debug session 26db2b to workspace-visible paths.
 * The HTTP ingest alone does not always mirror to the expected workspace file.
 */
export async function appendSessionDebugLine(payload: Record<string, unknown>): Promise<void> {
  const line = `${JSON.stringify(payload)}\n`
  const cwd = process.cwd()
  const rootPath = path.join(cwd, SESSION_LOG)
  const cursorDir = path.join(cwd, '.cursor')
  const cursorPath = path.join(cursorDir, SESSION_LOG)
  try {
    await mkdir(cursorDir, { recursive: true })
  } catch {
    // ignore
  }
  const errs: string[] = []
  for (const p of [rootPath, cursorPath]) {
    try {
      await appendFile(p, line, 'utf8')
    } catch (e) {
      errs.push(`${p}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (errs.length) {
    console.warn('[appendSessionDebugLine]', errs.join(' | '))
  }
}
