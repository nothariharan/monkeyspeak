'use client'

import { useEffect, useRef } from 'react'

/** Dev-only: one POST to /api/debug-log per tab so workspace NDJSON is guaranteed for session 26db2b. */
export function DebugSessionProbe() {
  const sent = useRef(false)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (sent.current) return
    sent.current = true
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '26db2b',
        runId: 'client-mount',
        hypothesisId: 'H0_logging_pipeline',
        location: 'components/DebugSessionProbe.tsx',
        message: 'Client mounted; relay POST for appendSessionDebugLine',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [])
  return null
}
