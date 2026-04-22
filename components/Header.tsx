'use client'

import { useTestStore } from '@/store/testStore'
import type { Mode } from '@/store/testStore'

interface HeaderProps {
  onSettingsOpen: () => void
}

export default function Header({ onSettingsOpen }: HeaderProps) {
  const { mode, setMode } = useTestStore()

  const handleMode = (m: Mode) => {
    setMode(m)
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 select-none">
      {/* Logo */}
      <span
        className="text-xl font-mono lowercase tracking-tight"
        style={{ color: 'var(--text-active)' }}
        aria-label="MonkeySpeak"
      >
        monkey<span style={{ color: 'var(--accent)' }}>speak</span>
      </span>

      {/* Mode switcher */}
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--text-muted)' }}
        role="tablist"
        aria-label="Mode selection"
      >
        <button
          id="mode-speed"
          role="tab"
          aria-selected={mode === 'speed'}
          className={`mode-tab ${mode === 'speed' ? 'active' : ''}`}
          onClick={() => handleMode('speed')}
        >
          speed
        </button>
        <button
          id="mode-clarity"
          role="tab"
          aria-selected={mode === 'clarity'}
          className={`mode-tab ${mode === 'clarity' ? 'active' : ''}`}
          onClick={() => handleMode('clarity')}
        >
          clarity
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Settings */}
        <button
          id="btn-settings"
          aria-label="Open settings"
          onClick={onSettingsOpen}
          className="transition-colors duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: 'var(--text-stats)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
