import { THEMES, type ThemeName } from '@/lib/themes'

// css vars for one theme — matches globals.css :root tokens
export type ThemeTokenMap = Record<string, string>

// build token map from lib/themes so layout and runtime agree
export function buildThemeTokenMap(): Record<ThemeName, ThemeTokenMap> {
  const map = {} as Record<ThemeName, ThemeTokenMap>

  for (const t of Object.values(THEMES)) {
    map[t.name] = {
      '--bg': t.bg,
      '--bg-surface': t.bgSurface,
      '--surface': t.surface,
      '--border': t.border,
      '--shadow': t.shadow,
      '--text-muted': t.textMuted,
      '--text-stats': t.textStats,
      '--text-active': t.textActive,
      '--text-current': t.textCurrent,
      '--success': t.success,
      '--error': t.error,
      '--orange': t.orange,
    }
  }

  return map
}

// static [data-theme] blocks — no inline style on html (hydration safe)
export function buildThemeVarsCss(tokens: Record<ThemeName, ThemeTokenMap>): string {
  return Object.entries(tokens)
    .map(([name, vars]) => {
      const props = Object.entries(vars)
        .map(([key, value]) => `${key}:${value}`)
        .join(';')
      return `[data-theme="${name}"]{${props}}`
    })
    .join('')
}

// default accent before localStorage loads
export const DEFAULT_ACCENT_HEX = '#3b82f6'

// blocking head script — sets data-theme/font and injects #ms-accent
// we create the style node ourselves so React never hydrates its text content
export function buildThemeBootScript(themeNames: ThemeName[]): string {
  const themeLookup = Object.fromEntries(themeNames.map((name) => [name, 1]))
  return `(function(){try{
var raw=localStorage.getItem('monkeyspeak-settings');if(!raw)return;
var s=((JSON.parse(raw)||{}).state||{}).settings||{};
var themes=${JSON.stringify(themeLookup)};
var name=s.theme&&themes[s.theme]?s.theme:'latte';
var root=document.documentElement;
root.dataset.theme=name;
if(s.font)root.dataset.font=s.font;
if(s.fontSize)root.dataset.fontsize=s.fontSize;
var accent=s.accentHex||'${DEFAULT_ACCENT_HEX}';
var el=document.getElementById('ms-accent');
if(!el){el=document.createElement('style');el.id='ms-accent';document.head.appendChild(el)}
el.textContent=':root{--accent:'+accent+'}';
}catch(e){}})();`
}

// runtime accent updates from settings panel or store rehydrate
export function applyAccentHex(accentHex: string) {
  if (typeof document === 'undefined') return
  let el = document.getElementById('ms-accent')
  if (!el) {
    el = document.createElement('style')
    el.id = 'ms-accent'
    document.head.appendChild(el)
  }
  el.textContent = `:root{--accent:${accentHex}}`
}
