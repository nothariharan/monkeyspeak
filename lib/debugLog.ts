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

const DEBUG_INGEST_URL = 'http://127.0.0.1:7291/ingest/74562f5e-377a-4199-9293-9988125476d2'
const DEBUG_SESSION_ID = '26db2b'

export function emitDebugLog(payload: DebugPayload) {
  const body = JSON.stringify(payload)
  // #region agent log
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {})
  // #endregion
  // #region agent log
  fetch(DEBUG_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body,
  }).catch(() => {})
  // #endregion
}
