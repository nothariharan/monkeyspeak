# theme boot without hydration warnings

## what was going wrong

on every load a blocking script in `app/layout.tsx` reads saved settings from localStorage and applies the theme before first paint — stops a bright latte flash when someone prefers dark mode

the old approach wrote css vars straight onto `<html>` with `style.setProperty`. looked fine but react 18 hydration compares server html to client dom. by then `<html>` already had a `style="..."` the server never sent:

```
Warning: Extra attributes from the server: style
    at html
    at RootLayout (Server)
```

## how we fixed it

palette tokens now live in static css from `lib/themes.ts`:

```css
[data-theme="latte"] { --bg: #f5f2ea; --surface: #ffffff; … }
[data-theme="mocha"] { --bg: #0a0a0a; … }
```

the boot script only flips `data-theme`, `data-font`, and `data-fontsize` on `<html>` — no inline style on the root

accent color goes through `<style id="ms-accent">` instead. boot script and `applyTheme()` in `lib/themes.ts` both rewrite that tag

`<html>` uses `suppressHydrationWarning` because `data-theme` can legitimately differ between server default (latte) and localStorage before hydration finishes

## files

| file | role |
|------|------|
| `lib/themeBoot.ts` | token map, static css, boot script, `applyAccentHex()` |
| `lib/themes.ts` | `applyTheme()` sets data-theme + accent tag |
| `app/layout.tsx` | injects `#ms-theme-vars`, `#ms-accent`, boot script in head |

## verify locally

1. pick a dark theme + non-default accent in settings
2. hard refresh
3. console should not show the extra attributes style warning
4. no theme flash, accent still matches

## notes for later

- new theme? update `lib/themes.ts` only — layout css is generated at build time
- dont use `root.style.setProperty` for theme tokens on html — use data attrs or `#ms-accent`
- `suppressHydrationWarning` on html is for expected theme drift only, not a blanket fix elsewhere
