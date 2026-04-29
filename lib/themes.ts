// ─── Theme Definitions (Catppuccin-inspired) ──────────────────────────────────
// Latte = light · Frappe = medium dark · Macchiato = dark · Mocha = darkest

export type ThemeName = 'latte' | 'frappe' | 'macchiato' | 'mocha'

export interface AccentSwatch {
  name: string        // display name / identifier
  hex:  string        // the actual colour value
}

export interface ThemeDef {
  name:       ThemeName
  label:      string
  // Base UI colours
  bg:         string
  bgSurface:  string
  textMuted:  string
  textStats:  string
  textActive: string
  textCurrent: string  // For the current word to speak
  error:      string
  orange:     string
  // Accent swatches available in this theme
  accents:    AccentSwatch[]
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  latte: {
    name:         'latte',
    label:        'Latte',
    bg:           '#eff1f5',
    bgSurface:    '#e6e9ef',
    textMuted:    '#6c6f85', // Subtext0 (was #bcc0cc)
    textStats:    '#5c5f77', // Subtext1 (was #8c8fa1)
    textActive:   '#4c4f69',
    textCurrent:  '#4c4f69',
    error:        '#d20f39',
    orange:       '#fe640b',
    accents: [
      { name: 'rosewater', hex: '#dc8a78' },
      { name: 'flamingo',  hex: '#dd7878' },
      { name: 'pink',      hex: '#ea76cb' },
      { name: 'mauve',     hex: '#8839ef' },
      { name: 'red',       hex: '#d20f39' },
      { name: 'maroon',    hex: '#e64553' },
      { name: 'peach',     hex: '#fe640b' },
      { name: 'yellow',    hex: '#df8e1d' },
      { name: 'green',     hex: '#40a02b' },
      { name: 'teal',      hex: '#179299' },
      { name: 'sky',       hex: '#04a5e5' },
      { name: 'sapphire',  hex: '#209fb5' },
      { name: 'blue',      hex: '#1e66f5' },
      { name: 'lavender',  hex: '#7287fd' },
    ],
  },

  frappe: {
    name:         'frappe',
    label:        'Frappé',
    bg:           '#303446',
    bgSurface:    '#292c3c',
    textMuted:    '#838ba7', // Overlay0 (was #414559)
    textStats:    '#949cbb', // Overlay1 (was #737994)
    textActive:   '#c6d0f5',
    textCurrent:  '#c6d0f5', // Use active color for current by default
    error:        '#e78284',
    orange:       '#ef9f76',
    accents: [
      { name: 'rosewater', hex: '#f2d5cf' },
      { name: 'flamingo',  hex: '#eebebe' },
      { name: 'pink',      hex: '#f4b8e4' },
      { name: 'mauve',     hex: '#ca9ee6' },
      { name: 'red',       hex: '#e78284' },
      { name: 'maroon',    hex: '#ea999c' },
      { name: 'peach',     hex: '#ef9f76' },
      { name: 'yellow',    hex: '#e5c890' },
      { name: 'green',     hex: '#a6d189' },
      { name: 'teal',      hex: '#81c8be' },
      { name: 'sky',       hex: '#99d1db' },
      { name: 'sapphire',  hex: '#85c1dc' },
      { name: 'blue',      hex: '#8caaee' },
      { name: 'lavender',  hex: '#babbf1' },
    ],
  },

  macchiato: {
    name:         'macchiato',
    label:        'Macchiato',
    bg:           '#24273a',
    bgSurface:    '#1e2030',
    textMuted:    '#8087a2', // Overlay0 (was #363a4f)
    textStats:    '#939ab7', // Overlay1 (was #6e738d)
    textActive:   '#cad3f5',
    textCurrent:  '#cad3f5',
    error:        '#ed8796',
    orange:       '#f5a97f',
    accents: [
      { name: 'rosewater', hex: '#f4dbd6' },
      { name: 'flamingo',  hex: '#f0c6c6' },
      { name: 'pink',      hex: '#f5bde6' },
      { name: 'mauve',     hex: '#c6a0f6' },
      { name: 'red',       hex: '#ed8796' },
      { name: 'maroon',    hex: '#ee99a0' },
      { name: 'peach',     hex: '#f5a97f' },
      { name: 'yellow',    hex: '#eed49f' },
      { name: 'green',     hex: '#a6da95' },
      { name: 'teal',      hex: '#8bd5ca' },
      { name: 'sky',       hex: '#91d7e3' },
      { name: 'sapphire',  hex: '#7dc4e4' },
      { name: 'blue',      hex: '#8aadf4' },
      { name: 'lavender',  hex: '#b7bdf8' },
    ],
  },

  mocha: {
    name:         'mocha',
    label:        'Mocha',
    bg:           '#1e1e2e',
    bgSurface:    '#181825',
    textMuted:    '#7f849c', // Overlay0 (was #313244)
    textStats:    '#9399b2', // Overlay1 (was #6c7086)
    textActive:   '#cdd6f4',
    textCurrent:  '#cdd6f4',
    error:        '#f38ba8',
    orange:       '#fab387',
    accents: [
      { name: 'rosewater', hex: '#f5e0dc' },
      { name: 'flamingo',  hex: '#f2cdcd' },
      { name: 'pink',      hex: '#f5c2e7' },
      { name: 'mauve',     hex: '#cba6f7' },
      { name: 'red',       hex: '#f38ba8' },
      { name: 'maroon',    hex: '#eba0ac' },
      { name: 'peach',     hex: '#fab387' },
      { name: 'yellow',    hex: '#f9e2af' },
      { name: 'green',     hex: '#a6e3a1' },
      { name: 'teal',      hex: '#94e2d5' },
      { name: 'sky',       hex: '#89dceb' },
      { name: 'sapphire',  hex: '#74c7ec' },
      { name: 'blue',      hex: '#89b4fa' },
      { name: 'lavender',  hex: '#b4befe' },
    ],
  },
}

export const THEME_ORDER: ThemeName[] = ['latte', 'frappe', 'macchiato', 'mocha']

/**
 * Apply a theme + accent to the document root as CSS custom properties.
 * Called both on mount (restore) and on setting change.
 */
export function applyTheme(theme: ThemeDef, accentHex: string) {
  const root = document.documentElement
  root.style.setProperty('--bg',           theme.bg)
  root.style.setProperty('--bg-surface',   theme.bgSurface)
  root.style.setProperty('--text-muted',   theme.textMuted)
  root.style.setProperty('--text-stats',   theme.textStats)
  root.style.setProperty('--text-active',  theme.textActive)
  root.style.setProperty('--text-current', theme.textCurrent)
  root.style.setProperty('--error',        theme.error)
  root.style.setProperty('--orange',       theme.orange)
  root.style.setProperty('--accent',       accentHex)
  root.dataset.theme = theme.name
}
