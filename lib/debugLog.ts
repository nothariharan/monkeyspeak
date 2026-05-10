'use client'

type DebugPayload = {
  sessionId: string
  runId: string
  hypothesisId: string
  location: string
  message: string
  data: Record<string, unknown>
  timestamp: number
}

export function emitDebugLog(payload: DebugPayload) {
  const body = JSON.stringify(payload)
  // #region agent log
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {})
  // #endregion
}
