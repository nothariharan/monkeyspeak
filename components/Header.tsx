'use client'

import Link from 'next/link'
import { useTestStore } from '@/store/testStore'
import type { Mode } from '@/store/testStore'
import { THEMES, THEME_ORDER, applyTheme } from '@/lib/themes'
import type { ThemeName } from '@/lib/themes'
import LogoMark from '@/components/LogoMark'

interface HeaderProps {
  onSettingsOpen: () => void
  onProfileOpen: () => void
}

export default function Header({ onSettingsOpen, onProfileOpen }: HeaderProps) {
  const { mode, setMode, settings, updateSettings, testState } = useTestStore()

  if (testState === 'running' && mode !== 'clarity') return null
  // speed/ghost hide the chrome for focus. clarity keeps the header so u can cancel / hop modes.

  const handleMode = (m: Mode) => setMode(m)

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(settings.theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length] as ThemeName
    const theme = THEMES[next]
    const accent = settings.accentHex || theme.accents[0].hex
    updateSettings({ theme: next })
    applyTheme(theme, accent)
  }

  return (
    <header
      className="app-header grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4 select-none"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="justify-self-start min-w-0">
        <LogoMark />
      </div>

      {/* Center — mode switcher */}
      <div className="choice-strip app-header-modes shrink-0" role="tablist" aria-label="Mode selection">
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
        <button
          id="mode-ghost"
          role="tab"
          aria-selected={mode === 'ghost'}
          className={`mode-tab ${mode === 'ghost' ? 'active' : ''}`}
          onClick={() => handleMode('ghost')}
        >
          ghost trace
        </button>
      </div>

      {/* Right controls */}
      <div className="app-header-actions flex items-center justify-end justify-self-end gap-1 sm:gap-3">
        <Link href="/leaderboard" title="View leaderboard" aria-label="View leaderboard" className="header-icon-btn p-2.5 transition-opacity hover:opacity-70" style={{ color: 'var(--text-stats)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
            <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 11v5M8 20h8M10 16h4" />
          </svg>
        </Link>

        <button
          id="btn-profile"
          aria-label="Open profile"
          onClick={onProfileOpen}
          className="header-icon-btn p-2.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-stats)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <button
          type="button"
          id="btn-theme-toggle"
          aria-label="Toggle theme"
          onClick={cycleTheme}
          className="header-icon-btn p-2.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-stats)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>

        <button
          id="btn-settings"
          aria-label="Open settings"
          onClick={onSettingsOpen}
          className="header-icon-btn p-2.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-stats)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
