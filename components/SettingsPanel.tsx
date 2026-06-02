'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTestStore } from '@/store/testStore'
import { THEMES, THEME_ORDER, applyTheme } from '@/lib/themes'
import type { ThemeName } from '@/lib/themes'
import type { FontChoice, FontSize } from '@/store/testStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

const FONTS: { value: FontChoice; label: string }[] = [
  { value: 'jetbrains',   label: 'JetBrains Mono' },
  { value: 'fira',        label: 'Fira Code' },
  { value: 'inconsolata', label: 'Inconsolata' },
]
const SIZES: { value: FontSize; label: string }[] = [
  { value: 'small',  label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large',  label: 'L' },
]
const LANGS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (AU)' },
] as const

function Toggle({ on, onToggle, id }: { on: boolean; onToggle: () => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`toggle-track ${on ? 'on' : ''}`}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useTestStore()

  // Local preview state — which theme tab is active in the panel
  const [previewTheme, setPreviewTheme] = useState<ThemeName>(settings.theme || 'mocha')
  const currentThemeDef = THEMES[previewTheme] || THEMES.mocha

  // When the user picks a new theme tab, preview it immediately
  const handleThemeTab = (t: ThemeName) => {
    setPreviewTheme(t)
    // Auto-select the first accent of the new theme and apply
    const newTheme = THEMES[t]
    const firstAccent = newTheme.accents[0]
    updateSettings({ theme: t, accentHex: firstAccent.hex, accentName: firstAccent.name })
    applyTheme(newTheme, firstAccent.hex)
  }

  const handleAccent = (hex: string, name: string) => {
    updateSettings({ accentHex: hex, accentName: name })
    applyTheme(currentThemeDef, hex)
  }

  // Sync previewTheme with store whenever panel opens
  const handleOpen = () => {
    setPreviewTheme(settings.theme || 'mocha')
  }

  return (
    <AnimatePresence onExitComplete={() => {}}>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={onClose}
            onAnimationStart={handleOpen}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            key="settings-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 right-0 h-full w-[350px] z-50 overflow-y-auto flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--text-muted)',
            }}
            role="dialog"
            aria-label="Settings"
            aria-modal="true"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--text-muted)' }}
            >
              <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-active)' }}>
                settings
              </span>
              <button
                id="btn-close-settings"
                onClick={onClose}
                aria-label="Close settings"
                className="transition-opacity hover:opacity-60"
                style={{ color: 'var(--text-stats)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

              {/* ── THEME SECTION ──────────────────────────────────── */}
              <section className="flex flex-col gap-3">
                <p className="stat-label text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-stats)' }}>
                  theme
                </p>

                {/* Theme tabs */}
                <div
                  className="flex items-center rounded-lg p-1 gap-0.5"
                  style={{ background: 'var(--bg)', border: '1px solid var(--text-muted)' }}
                  role="tablist"
                  aria-label="Theme"
                >
                  {THEME_ORDER.map((t) => {
                    const def = THEMES[t]
                    const isActive = previewTheme === t
                    return (
                      <button
                        key={t}
                        id={`theme-tab-${t}`}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleThemeTab(t)}
                        className="flex-1 py-1 px-1.5 rounded-md text-xs font-mono font-medium transition-all duration-150 whitespace-nowrap"
                        style={{
                          background: isActive ? 'var(--accent)' : 'transparent',
                          color: isActive ? def.bg : 'var(--text-stats)',
                        }}
                      >
                        {def.label}
                      </button>
                    )
                  })}
                </div>

                {/* Theme preview strip */}
                <div
                  className="rounded-lg p-3 flex items-center justify-between text-xs font-mono"
                  style={{
                    background: currentThemeDef.bg,
                    border: `1px solid ${currentThemeDef.textMuted}`,
                  }}
                >
                  <span style={{ color: currentThemeDef.textStats }}>preview</span>
                  <span style={{ color: currentThemeDef.textActive }}>monkey</span>
                  <span style={{ color: settings.accentHex || currentThemeDef.accents[0].hex }}>speak</span>
                  <span style={{ color: currentThemeDef.error }}>error</span>
                </div>

                {/* Accent colour grid */}
                <p className="stat-label text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--text-stats)' }}>
                  accent
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {currentThemeDef.accents.map(({ name, hex }) => {
                    const isSelected = settings.accentHex === hex && settings.theme === previewTheme
                    return (
                      <button
                        key={name}
                        id={`accent-${name}`}
                        onClick={() => handleAccent(hex, name)}
                        title={name}
                        aria-label={name}
                        aria-pressed={isSelected}
                        className="w-8 h-8 rounded-lg transition-all duration-150 relative"
                        style={{
                          background: hex,
                          outline: isSelected ? `2px solid var(--text-active)` : '2px solid transparent',
                          outlineOffset: '2px',
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke={currentThemeDef.bg} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--text-muted)', opacity: 0.4 }} />

              {/* ── FONT SECTION ──────────────────────────────────── */}
              <section className="flex flex-col gap-3">
                <p className="stat-label text-xs uppercase tracking-widest" style={{ color: 'var(--text-stats)' }}>
                  font
                </p>
                <div className="flex flex-col gap-1">
                  {FONTS.map(({ value, label }) => (
                    <button
                      key={value}
                      id={`font-${value}`}
                      onClick={() => updateSettings({ font: value })}
                      aria-pressed={settings.font === value}
                      className="text-left px-3 py-2 rounded-lg text-sm transition-all duration-150"
                      style={{
                        fontFamily: `'${label}', monospace`,
                        background: settings.font === value ? 'var(--text-muted)' : 'transparent',
                        color: settings.font === value ? 'var(--text-active)' : 'var(--text-stats)',
                        border: `1px solid ${settings.font === value ? 'var(--text-stats)' : 'transparent'}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Font size */}
                <p className="stat-label text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--text-stats)' }}>
                  size
                </p>
                <div className="flex gap-2">
                  {SIZES.map(({ value, label }) => (
                    <button
                      key={value}
                      id={`fontsize-${value}`}
                      onClick={() => updateSettings({ fontSize: value })}
                      aria-pressed={settings.fontSize === value}
                      className="flex-1 py-1.5 rounded-lg text-sm font-mono font-medium transition-all duration-150"
                      style={{
                        background: settings.fontSize === value ? 'var(--accent)' : 'var(--bg)',
                        color: settings.fontSize === value ? currentThemeDef.bg : 'var(--text-stats)',
                        border: '1px solid var(--text-muted)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--text-muted)', opacity: 0.4 }} />

              {/* ── TOGGLES ──────────────────────────────────────── */}
              <section className="flex flex-col gap-4">
                <p className="stat-label text-xs uppercase tracking-widest" style={{ color: 'var(--text-stats)' }}>
                  behaviour
                </p>
                {[
                  { id: 'toggle-filler-flash',    label: 'filler flash',    key: 'fillerFlash' as const },
                  { id: 'toggle-live-transcript', label: 'live transcript', key: 'showLiveTranscript' as const },
                  { id: 'toggle-smooth-caret',    label: 'smooth caret',    key: 'smoothCaret' as const },
                  { id: 'toggle-blind-mode',      label: 'blind mode',      key: 'blindMode' as const },
                  { id: 'toggle-skip-vad',        label: 'send all audio (skip VAD)', key: 'skipVad' as const },
                ].map(({ id, label, key }) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-sm font-mono" style={{ color: 'var(--text-active)' }}>{label}</span>
                    <Toggle
                      id={id}
                      on={settings[key]}
                      onToggle={() => updateSettings({ [key]: !settings[key] })}
                    />
                  </div>
                ))}
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid var(--text-muted)', opacity: 0.4 }} />

              {/* ── LANGUAGE ─────────────────────────────────────── */}
              <section className="flex flex-col gap-3">
                <p className="stat-label text-xs uppercase tracking-widest" style={{ color: 'var(--text-stats)' }}>
                  language
                </p>
                <select
                  id="select-language"
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value as typeof settings.language })}
                  className="rounded-lg px-3 py-2 text-sm font-mono w-full"
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--text-active)',
                    border: '1px solid var(--text-muted)',
                    outline: 'none',
                  }}
                >
                  {LANGS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </section>

            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
