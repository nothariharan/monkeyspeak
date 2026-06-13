// ─── Brutalist Theme Definitions ─────────────────────────────────────────────
// Latte = light (default) · Frappe = medium · Macchiato = dark · Mocha = darkest

export type ThemeName = 'latte' | 'frappe' | 'macchiato' | 'mocha'

export interface AccentSwatch {
  name: string
  hex:  string
}

export interface ThemeDef {
  name:       ThemeName
  label:      string
  bg:         string
  bgSurface:  string
  surface:    string
  border:     string
  shadow:     string
  textMuted:  string
  textStats:  string
  textActive: string
  textCurrent: string
  success:    string
  error:      string
  orange:     string
  accents:    AccentSwatch[]
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  latte: {
    name:         'latte',
    label:        'Light',
    bg:           '#f5f2ea',
    bgSurface:    '#ffffff',
    surface:      '#ffffff',
    border:       '#111111',
    shadow:       '#111111',
    textMuted:    '#a8a8a8',
    textStats:    '#666666',
    textActive:   '#111111',
    textCurrent:  '#111111',
    success:      '#22c55e',
    error:        '#ef4444',
    orange:       '#f97316',
    accents: [
      { name: 'rosewater', hex: '#dc8a78' },
      { name: 'flamingo',  hex: '#dd7878' },
      { name: 'pink',      hex: '#ea76cb' },
      { name: 'mauve',     hex: '#8839ef' },
      { name: 'red',       hex: '#ef4444' },
      { name: 'maroon',    hex: '#e64553' },
      { name: 'peach',     hex: '#fe640b' },
      { name: 'yellow',    hex: '#eab308' },
      { name: 'green',     hex: '#22c55e' },
      { name: 'teal',      hex: '#14b8a6' },
      { name: 'sky',       hex: '#0ea5e9' },
      { name: 'sapphire',  hex: '#209fb5' },
      { name: 'blue',      hex: '#3b82f6' },
      { name: 'lavender',  hex: '#8b5cf6' },
    ],
  },

  frappe: {
    name:         'frappe',
    label:        'Sand',
    bg:           '#e8e4d9',
    bgSurface:    '#f0ece3',
    surface:      '#f5f2ea',
    border:       '#111111',
    shadow:       '#111111',
    textMuted:    '#8a8578',
    textStats:    '#5c5a52',
    textActive:   '#1a1a1a',
    textCurrent:  '#1a1a1a',
    success:      '#16a34a',
    error:        '#dc2626',
    orange:       '#ea580c',
    accents: [
      { name: 'rosewater', hex: '#c97b6d' },
      { name: 'flamingo',  hex: '#c96b6b' },
      { name: 'pink',      hex: '#d45bb5' },
      { name: 'mauve',     hex: '#7c3aed' },
      { name: 'red',       hex: '#dc2626' },
      { name: 'maroon',    hex: '#c44553' },
      { name: 'peach',     hex: '#ea580c' },
      { name: 'yellow',    hex: '#ca8a04' },
      { name: 'green',     hex: '#16a34a' },
      { name: 'teal',      hex: '#0d9488' },
      { name: 'sky',       hex: '#0284c7' },
      { name: 'sapphire',  hex: '#1a8fb5' },
      { name: 'blue',      hex: '#2563eb' },
      { name: 'lavender',  hex: '#7c3aed' },
    ],
  },

  macchiato: {
    name:         'macchiato',
    label:        'Dark',
    bg:           '#1a1a2e',
    bgSurface:    '#16213e',
    surface:      '#0f3460',
    border:       '#e2e2e2',
    shadow:       '#000000',
    textMuted:    '#6b7280',
    textStats:    '#9ca3af',
    textActive:   '#f3f4f6',
    textCurrent:  '#f3f4f6',
    success:      '#4ade80',
    error:        '#f87171',
    orange:       '#fb923c',
    accents: [
      { name: 'rosewater', hex: '#f4dbd6' },
      { name: 'flamingo',  hex: '#f0c6c6' },
      { name: 'pink',      hex: '#f5bde6' },
      { name: 'mauve',     hex: '#c6a0f6' },
      { name: 'red',       hex: '#f87171' },
      { name: 'maroon',    hex: '#ee99a0' },
      { name: 'peach',     hex: '#fb923c' },
      { name: 'yellow',    hex: '#facc15' },
      { name: 'green',     hex: '#4ade80' },
      { name: 'teal',      hex: '#2dd4bf' },
      { name: 'sky',       hex: '#38bdf8' },
      { name: 'sapphire',  hex: '#7dc4e4' },
      { name: 'blue',      hex: '#60a5fa' },
      { name: 'lavender',  hex: '#a78bfa' },
    ],
  },

  mocha: {
    name:         'mocha',
    label:        'Black',
    bg:           '#0a0a0a',
    bgSurface:    '#141414',
    surface:      '#1a1a1a',
    border:       '#ffffff',
    shadow:       '#ffffff',
    textMuted:    '#525252',
    textStats:    '#a3a3a3',
    textActive:   '#fafafa',
    textCurrent:  '#fafafa',
    success:      '#86efac',
    error:        '#fca5a5',
    orange:       '#fdba74',
    accents: [
      { name: 'rosewater', hex: '#fecaca' },
      { name: 'flamingo',  hex: '#fca5a5' },
      { name: 'pink',      hex: '#f9a8d4' },
      { name: 'mauve',     hex: '#d8b4fe' },
      { name: 'red',       hex: '#fca5a5' },
      { name: 'maroon',    hex: '#fda4af' },
      { name: 'peach',     hex: '#fdba74' },
      { name: 'yellow',    hex: '#fde047' },
      { name: 'green',     hex: '#86efac' },
      { name: 'teal',      hex: '#5eead4' },
      { name: 'sky',       hex: '#7dd3fc' },
      { name: 'sapphire',  hex: '#93c5fd' },
      { name: 'blue',      hex: '#93c5fd' },
      { name: 'lavender',  hex: '#c4b5fd' },
    ],
  },
}

export const THEME_ORDER: ThemeName[] = ['latte', 'frappe', 'macchiato', 'mocha']

/**
 * push theme tokens onto :root. accent comes from user settings, not hardcoded.
 */
export function applyTheme(theme: ThemeDef, accentHex: string) {
  const root = document.documentElement
  root.style.setProperty('--bg',           theme.bg)
  root.style.setProperty('--bg-surface',   theme.bgSurface)
  root.style.setProperty('--surface',     theme.surface)
  root.style.setProperty('--border',      theme.border)
  root.style.setProperty('--shadow',      theme.shadow)
  root.style.setProperty('--text-muted',  theme.textMuted)
  root.style.setProperty('--text-stats',  theme.textStats)
  root.style.setProperty('--text-active', theme.textActive)
  root.style.setProperty('--text-current', theme.textCurrent)
  root.style.setProperty('--success',     theme.success)
  root.style.setProperty('--error',       theme.error)
  root.style.setProperty('--orange',      theme.orange)
  root.style.setProperty('--accent',      accentHex)
  root.dataset.theme = theme.name
}
