'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string | null
  onDismiss: () => void
  durationMs?: number
}

export default function Toast({ message, onDismiss, durationMs = 3500 }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) { setVisible(false); return }
    setVisible(true)
    const t = window.setTimeout(() => { setVisible(false); onDismiss() }, durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDismiss])

  if (!visible || !message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="font-mono"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 100,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '0.78rem',
        padding: '0.55rem 1rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        maxWidth: '22rem',
      }}
    >
      {message}
    </div>
  )
}
