# Theme boot without hydration warnings

## What was going wrong

On every page load, a small blocking script in `app/layout.tsx` reads the user's
saved settings from `localStorage` and applies their theme before the first paint.
That prevents a bright "latte" flash when someone prefers a dark palette.

The old approach wrote every CSS variable directly onto `<html>` via
`document.documentElement.style.setProperty(...)`. That worked visually, but React
18's hydration pass compares the server HTML to the client DOM. By the time React
ran, `<html>` already carried a `style="..."` attribute the server never sent —
hence the console warning:

```
Warning: Extra attributes from the server: style
    at html
    at RootLayout (Server)
```

## How we fixed it

Theme palette tokens now live in static CSS generated from `lib/themes.ts`:

```css
[data-theme="latte"] { --bg: #f5f2ea; --surface: #ffffff; … }
[data-theme="mocha"] { --bg: #0a0a0a; … }
```

The boot script only flips `data-theme`, `data-font`, and `data-fontsize` on
`<html>`. No inline `style=""` on the root element.

The accent color is still user-configurable, but it is injected through a
dedicated `<style id="ms-accent">` tag instead of inline styles. Both the boot
script and `applyTheme()` in `lib/themes.ts` rewrite that tag's contents.

`<html>` also uses `suppressHydrationWarning` because `data-theme` may legitimately
differ between the server default (`latte`) and what localStorage says before
hydration completes.

## Files involved

| File | Role |
|------|------|
| `lib/themeBoot.ts` | Builds token map, static CSS, boot script, and `applyAccentHex()` |
| `lib/themes.ts` | `applyTheme()` sets `data-theme` + accent tag |
| `app/layout.tsx` | Injects `#ms-theme-vars`, `#ms-accent`, and the boot script in `<head>` |

## Verifying locally

1. Pick a dark theme and a non-default accent in Settings.
2. Hard-refresh the page.
3. Open DevTools → Console — the `Extra attributes from the server: style` warning
   should be gone.
4. Confirm there is no theme flash and the accent color still matches your pick.

## Notes for future changes

- If you add a new theme, update `lib/themes.ts` only — layout CSS is generated
  from that file at build time.
- Avoid `root.style.setProperty` for theme tokens on `<html>`; use `data-*` attrs
  or the `#ms-accent` style tag pattern instead.
- `suppressHydrationWarning` on `<html>` is scoped to expected theme drift; don't
  use it as a blanket fix on other elements.
