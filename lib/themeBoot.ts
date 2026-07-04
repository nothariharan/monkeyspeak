import { THEMES, type ThemeName } from '@/lib/themes'

/** CSS variable map for one theme — mirrors what globals.css expects on :root. */
export type ThemeTokenMap = Record<string, string>

/** Build the token map from lib/themes.ts so layout and runtime stay in sync. */
export function buildThemeTokenMap(): Record<ThemeName, ThemeTokenMap> {
  return Object.fromEntries(
    Object.values(THEMES).map((t) => [
      t.name,
      {
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
      },
    ])
  ) as Record<ThemeName, ThemeTokenMap>
}

/** Static CSS: one [data-theme] block per palette. No inline styles on <html>. */
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

/** Default accent before localStorage hydrates — latte blue swatch. */
export const DEFAULT_ACCENT_HEX = '#3b82f6'

/**
 * Blocking head script: flip data-theme / font attrs and patch #ms-accent.
 * We deliberately avoid root.style.setProperty — that left a style="" on <html>
 * and React complained during hydration.
 */
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
if(el)el.textContent='html{--accent:'+accent+'}';
}catch(e){}})();`
}

/** Runtime accent updates (settings panel, store rehydrate). Same path as the boot script. */
export function applyAccentHex(accentHex: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById('ms-accent')
  if (el) {
    el.textContent = `html{--accent:${accentHex}}`
  }
}
