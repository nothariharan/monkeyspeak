'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.warn('[monkeyspeak] render error:', error)
  }, [error])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'var(--bg)', color: 'var(--text-active)' }}
    >
      <span className="text-6xl">🙈</span>
      <h1 className="font-display font-black text-2xl">something broke</h1>
      <p className="font-mono text-xs max-w-sm" style={{ color: 'var(--text-stats)' }}>
        the monkey dropped the mic. this run hit an unexpected error — try again, and
        if it keeps happening, reload the page.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="desk-btn desk-btn-primary"
        >
          try again
        </button>
        <a href="/" className="desk-btn desk-btn-quiet">
          back home
        </a>
      </div>
    </div>
  )
}
