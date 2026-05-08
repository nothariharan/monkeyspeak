export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { appendSessionDebugLine } = await import('@/lib/debugSessionLog')
  await appendSessionDebugLine({
    sessionId: '26db2b',
    runId: 'instrumentation',
    hypothesisId: 'H0_logging_pipeline',
    location: 'instrumentation.ts:register',
    message: 'Next.js register() ran; server-side log path check',
    data: { cwd: process.cwd(), nodeEnv: process.env.NODE_ENV },
    timestamp: Date.now(),
  })
}
