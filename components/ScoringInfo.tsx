'use client'

import { useEffect, useRef, useState } from 'react'

const FILLER_LIST = 'um · uh · er · like · you know · basically · literally · right · so · actually · sort of · kind of · i mean · you see · well'

export default function ScoringInfo() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="How scoring works"
        aria-expanded={open}
        style={{
          width: '1.1rem',
          height: '1.1rem',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: '0.65rem',
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-muted)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-active)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }}
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 0.5rem)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            width: '20rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '0.9rem 1rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            lineHeight: 1.65,
          }}
        >
          <p style={{ fontWeight: 700, color: 'var(--text-active)', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
            how scoring works
          </p>

          <Row label="net wpm">
            (correct chars ÷ 5) × (60 ÷ seconds) — only correctly spoken words count
          </Row>
          <Row label="raw wpm">
            all spoken characters at the same rate — includes mistakes
          </Row>
          <Row label="accuracy">
            correct words ÷ total prompt words × 100
          </Row>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.55rem 0' }} />

          <Row label="phonetic">
            colour = color, gonna = going to — matched via Double Metaphone, counts as correct
          </Row>
          <Row label="fillers stripped">
            {FILLER_LIST}
          </Row>
          <Row label="repeats">
            first match wins; duplicate words counted as extra (don't hurt accuracy)
          </Row>
          <Row label="corrections">
            uncorrected mistakes count as substitutions; the word after still aligns normally
          </Row>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr', gap: '0 0.5rem', marginBottom: '0.3rem' }}>
      <span style={{ color: 'var(--text-stats)', fontWeight: 600, paddingTop: '0.05rem' }}>{label}</span>
      <span>{children}</span>
    </div>
  )
}
