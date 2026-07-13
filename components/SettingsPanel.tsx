'use client'

import { useState, useEffect, useRef } from 'react'
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
  { value: 'jetbrains', label: 'JetBrains Mono' },
  { value: 'fira', label: 'Fira Code' },
  { value: 'inconsolata', label: 'Inconsolata' },
]

const SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: 's' },
  { value: 'medium', label: 'm' },
  { value: 'large', label: 'l' },
]

const LANGS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (AU)' },
] as const

function Toggle({ on, onToggle, id }: { on: boolean; onToggle: () => void; id: string }) {
  return (
    <button id={id} role="switch" aria-checked={on} onClick={onToggle} className={`settings-toggle ${on ? 'on' : ''}`}>
      <span className="settings-toggle-thumb" />
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
      gsap.from(panelRef.current, { x: '100%', duration: 0.28, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        ref={backdropRef}
        className="settings-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="settings-panel"
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div className="settings-panel-head">
          <span>settings</span>
          <button
            id="btn-close-settings"
            onClick={onClose}
            aria-label="Close settings"
            className="settings-close-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-panel-body">
          <section className="settings-section">
            <p className="settings-label">theme</p>
            <div className="settings-segment" role="tablist" aria-label="Theme">
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
                    className={isActive ? 'active' : ''}
                  >
                    {def.label}
                  </button>
                )
              })}
            </div>

            <div className="settings-preview" style={{ background: currentThemeDef.bg }}>
              <span style={{ color: currentThemeDef.textStats }}>preview</span>
              <span style={{ color: currentThemeDef.textActive }}>speak</span>
              <span style={{ color: settings.accentHex || currentThemeDef.accents[0].hex }}>fast</span>
              <span style={{ color: currentThemeDef.error }}>err</span>
            </div>

            <p className="settings-label">accent</p>
            <div className="settings-accent-grid">
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
                    className={`settings-accent-swatch${isSelected ? ' active' : ''}`}
                    style={{ background: hex }}
                  />
                )
              })}
            </div>
          </section>

          <section className="settings-section">
            <p className="settings-label">font</p>
            <div className="settings-stack">
              {FONTS.map(({ value, label }) => (
                <button
                  key={value}
                  id={`font-${value}`}
                  onClick={() => updateSettings({ font: value })}
                  aria-pressed={settings.font === value}
                  className={`settings-stack-btn${settings.font === value ? ' active' : ''}`}
                  style={{ fontFamily: `'${label}', monospace` }}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="settings-label">size</p>
            <div className="settings-segment">
              {SIZES.map(({ value, label }) => (
                <button
                  key={value}
                  id={`fontsize-${value}`}
                  onClick={() => updateSettings({ fontSize: value })}
                  aria-pressed={settings.fontSize === value}
                  className={settings.fontSize === value ? 'active' : ''}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <p className="settings-label">behaviour</p>
            {[
              { id: 'toggle-filler-flash', label: 'filler flash', key: 'fillerFlash' as const },
              { id: 'toggle-smooth-caret', label: 'smooth caret', key: 'smoothCaret' as const },
              { id: 'toggle-blind-mode', label: 'blind mode', key: 'blindMode' as const },
              { id: 'toggle-skip-vad', label: 'send all audio', key: 'skipVad' as const },
            ].map(({ id, label, key }) => (
              <div key={id} className="settings-row">
                <span>{label}</span>
                <Toggle id={id} on={settings[key]} onToggle={() => updateSettings({ [key]: !settings[key] })} />
              </div>
            ))}
          </section>

          <section className="settings-section">
            <p className="settings-label">language</p>
            <select
              id="select-language"
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as typeof settings.language })}
              className="settings-select"
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
