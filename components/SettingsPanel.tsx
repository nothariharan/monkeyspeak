'use client'

import { useState } from 'react'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
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
    <button id={id} role="switch" aria-checked={on} onClick={onToggle} className={`toggle-track ${on ? 'on' : ''}`}>
      <span className="toggle-thumb" />
    </button>
  )
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useTestStore()
  const panelRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const [previewTheme, setPreviewTheme] = useState<ThemeName>(settings.theme || 'latte')
  const currentThemeDef = THEMES[previewTheme] || THEMES.latte

  const handleThemeTab = (t: ThemeName) => {
    setPreviewTheme(t)
    const newTheme = THEMES[t]
    const firstAccent = newTheme.accents[0]
    updateSettings({ theme: t, accentHex: firstAccent.hex, accentName: firstAccent.name })
    applyTheme(newTheme, firstAccent.hex)
  }

  const handleAccent = (hex: string, name: string) => {
    updateSettings({ accentHex: hex, accentName: name })
    applyTheme(currentThemeDef, hex)
  }

  useEffect(() => {
    if (!isOpen) return
    setPreviewTheme(settings.theme || 'latte')
  }, [isOpen, settings.theme])

  useEffect(() => {
    if (!isOpen || !panelRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(backdropRef.current, { opacity: 0, duration: 0.2 })
      gsap.from(panelRef.current, { x: '100%', duration: 0.3, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[360px] z-50 overflow-y-auto flex flex-col brutal-card"
        style={{
          background: 'var(--surface)',
          borderRight: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          boxShadow: '-8px 0 0 var(--shadow)',
        }}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '3px solid var(--border)' }}
        >
          <span className="font-display text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-active)' }}>
            Settings
          </span>
          <button
            id="btn-close-settings"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-stats)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* Theme */}
          <section className="flex flex-col gap-3">
            <p className="stat-label">theme</p>
            <div className="brutal-segment w-full" role="tablist" aria-label="Theme">
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
                    className="mode-tab flex-1 text-center"
                    style={{
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      color: isActive ? '#fff' : 'var(--text-stats)',
                    }}
                  >
                    {def.label}
                  </button>
                )
              })}
            </div>

            <div
              className="brutal-card-sm p-3 flex items-center justify-between font-mono text-xs"
              style={{ background: currentThemeDef.bg }}
            >
              <span style={{ color: currentThemeDef.textStats }}>preview</span>
              <span style={{ color: currentThemeDef.textActive }}>speak</span>
              <span style={{ color: settings.accentHex || currentThemeDef.accents[0].hex }}>fast</span>
              <span style={{ color: currentThemeDef.error }}>err</span>
            </div>

            <p className="stat-label mt-1">accent</p>
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
                    className="w-8 h-8 transition-transform"
                    style={{
                      background: hex,
                      border: isSelected ? '3px solid var(--border)' : '2px solid var(--border)',
                      boxShadow: isSelected ? '3px 3px 0 var(--shadow)' : '2px 2px 0 var(--shadow)',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {isSelected && (
                      <span className="flex items-center justify-center h-full">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '3px solid var(--border)' }} />

          {/* Font */}
          <section className="flex flex-col gap-3">
            <p className="stat-label">font</p>
            <div className="flex flex-col gap-2">
              {FONTS.map(({ value, label }) => (
                <button
                  key={value}
                  id={`font-${value}`}
                  onClick={() => updateSettings({ font: value })}
                  aria-pressed={settings.font === value}
                  className="text-left px-3 py-2 font-mono text-sm transition-all brutal-card-sm"
                  style={{
                    fontFamily: `'${label}', monospace`,
                    background: settings.font === value ? 'var(--accent)' : 'var(--surface)',
                    color: settings.font === value ? '#fff' : 'var(--text-stats)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="stat-label mt-1">size</p>
            <div className="brutal-segment w-full">
              {SIZES.map(({ value, label }) => (
                <button
                  key={value}
                  id={`fontsize-${value}`}
                  onClick={() => updateSettings({ fontSize: value })}
                  aria-pressed={settings.fontSize === value}
                  className="mode-tab flex-1 text-center"
                  style={{
                    background: settings.fontSize === value ? 'var(--accent)' : 'var(--surface)',
                    color: settings.fontSize === value ? '#fff' : 'var(--text-stats)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '3px solid var(--border)' }} />

          {/* Toggles */}
          <section className="flex flex-col gap-4">
            <p className="stat-label">behaviour</p>
            {[
              { id: 'toggle-filler-flash',    label: 'filler flash',    key: 'fillerFlash' as const },
              { id: 'toggle-live-transcript', label: 'live transcript', key: 'showLiveTranscript' as const },
              { id: 'toggle-smooth-caret',    label: 'smooth caret',    key: 'smoothCaret' as const },
              { id: 'toggle-blind-mode',      label: 'blind mode',      key: 'blindMode' as const },
              { id: 'toggle-skip-vad',        label: 'send all audio (skip VAD)', key: 'skipVad' as const },
            ].map(({ id, label, key }) => (
              <div key={id} className="flex items-center justify-between">
                <span className="font-mono text-sm" style={{ color: 'var(--text-active)' }}>{label}</span>
                <Toggle id={id} on={settings[key]} onToggle={() => updateSettings({ [key]: !settings[key] })} />
              </div>
            ))}
          </section>

          <hr style={{ border: 'none', borderTop: '3px solid var(--border)' }} />

          {/* Language */}
          <section className="flex flex-col gap-3">
            <p className="stat-label">language</p>
            <select
              id="select-language"
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as typeof settings.language })}
              className="brutal-card-sm px-3 py-2 font-mono text-sm w-full"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-active)',
                outline: 'none',
              }}
            >
              {LANGS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </section>
        </div>
      </aside>
    </>
  )
}
