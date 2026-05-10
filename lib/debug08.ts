const DEBUG_08_LOG = 'debug-08c9af.log'

/**
 * NDJSON append for debug session 08c9af (server-only).
 * Mirrors appendSessionDebugLine paths so logs land in repo root and `.cursor/`.
 */
export async function appendDebug08Line(payload: Record<string, unknown>): Promise<void> {
  if (payload.sessionId !== '08c9af') return
  const [{ appendFile, mkdir }, path] = await Promise.all([
    import('fs/promises'),
    import('path'),
  ])
  const line = `${JSON.stringify(payload)}\n`
  const cwd = process.cwd()
  const rootPath = path.join(cwd, DEBUG_08_LOG)
  const cursorDir = path.join(cwd, '.cursor')
  const cursorPath = path.join(cursorDir, DEBUG_08_LOG)
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
    console.warn('[appendDebug08Line]', errs.join(' | '))
  }
}
