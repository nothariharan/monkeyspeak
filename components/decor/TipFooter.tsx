'use client'

import MonkeyMascot from './MonkeyMascot'

export default function TipFooter() {
  return (
    <footer className="w-full max-w-3xl mx-auto px-6 pb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      <div
        className="brutal-card-sm flex-1 flex items-center gap-4 p-4"
        style={{ background: '#fef9c3' }}
      >
        <MonkeyMascot size={40} />
        <div>
          <p
            className="font-display text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--border)' }}
          >
            Tip
          </p>
          <p className="text-sm font-mono" style={{ color: 'var(--text-active)' }}>
            Speak clearly and at a natural pace for the best results.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="brutal-btn brutal-btn-outline shrink-0"
        aria-label="How it works"
        onClick={() => {}}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        How it works?
      </button>
    </footer>
  )
}
