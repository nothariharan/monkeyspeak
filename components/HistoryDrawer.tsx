'use client'

import { useEffect, useRef } from 'react'
import { useTestStore } from '@/store/testStore'
import type { SessionHistoryEntry } from '@/store/testStore'

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentPbWpm?: number
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function EntryRow({ entry, isBest }: { entry: SessionHistoryEntry; isBest: boolean }) {
  return (
    <div
      className="font-mono"
      style={{
        display: 'grid',
        gridTemplateColumns: '3.5rem 1fr 3rem 3rem',
        gap: '0 0.75rem',
        padding: '0.55rem 0',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.75rem',
        color: isBest ? 'var(--accent)' : 'var(--text-muted)',
        alignItems: 'center',
      }}
    >
      <span style={{ fontWeight: 700, color: isBest ? 'var(--accent)' : 'var(--text-active)', fontSize: '0.9rem' }}>
        {entry.netWpm}
        <span style={{ fontSize: '0.6rem', fontWeight: 400, marginLeft: '0.2rem', color: 'var(--text-stats)' }}>wpm</span>
      </span>
      <span style={{ color: 'var(--text-stats)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {formatDate(entry.date)}
        {' · '}{entry.duration}s {entry.promptType}
      </span>
      <span style={{ textAlign: 'right', color: 'var(--text-stats)' }}>
        {entry.accuracy}%
      </span>
      <span style={{ textAlign: 'right', color: entry.fillerCount > 0 ? 'var(--warn, #f59e0b)' : 'var(--text-stats)' }}>
        {entry.fillerCount > 0 ? `${entry.fillerCount}f` : '—'}
      </span>
    </div>
  )
}

export default function HistoryDrawer({ isOpen, onClose, currentPbWpm }: HistoryDrawerProps) {
  const settings = useTestStore((s) => s.settings)
  const updateSettings = useTestStore((s) => s.updateSettings)
  const overlayRef = useRef<HTMLDivElement>(null)

  const history = settings.sessionHistory ?? []
  const bestWpm = history.reduce((max, e) => Math.max(max, e.netWpm), 0)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleClear = () => {
    if (!window.confirm('Clear all history? This cannot be undone.')) return
    updateSettings({ sessionHistory: [] })
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Run history"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '70vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem 0.75rem 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="font-display font-bold" style={{ color: 'var(--text-active)', fontSize: '0.9rem' }}>run history</p>
            <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-stats)', marginTop: '0.1rem' }}>
              {history.length} run{history.length !== 1 ? 's' : ''} · best {bestWpm > 0 ? `${bestWpm} wpm` : '—'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="font-mono"
                style={{ fontSize: '0.68rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
              >
                clear
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close history"
              className="plain-icon-btn"
              style={{ fontSize: '1.1rem', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* column headers */}
        {history.length > 0 && (
          <div
            className="font-mono"
            style={{
              display: 'grid',
              gridTemplateColumns: '3.5rem 1fr 3rem 3rem',
              gap: '0 0.75rem',
              padding: '0.35rem 1.25rem',
              fontSize: '0.62rem',
              color: 'var(--text-stats)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <span>wpm</span>
            <span>date · mode</span>
            <span style={{ textAlign: 'right' }}>acc</span>
            <span style={{ textAlign: 'right' }}>fill</span>
          </div>
        )}

        {/* rows */}
        <div style={{ overflowY: 'auto', padding: '0 1.25rem', flex: 1 }}>
          {history.length === 0 ? (
            <p className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '1.5rem 0', textAlign: 'center' }}>
              no runs yet — complete a speed test to see history
            </p>
          ) : (
            history.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                isBest={entry.netWpm === bestWpm && bestWpm > 0}
              />
            ))
          )}
        </div>

        <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-stats)' }}>last 20 runs · stored locally</p>
        </div>
      </div>
    </div>
  )
}
