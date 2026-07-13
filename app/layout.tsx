import type { Metadata, Viewport } from 'next'
import {
  buildThemeBootScript,
  buildThemeTokenMap,
  buildThemeVarsCss,
} from '@/lib/themeBoot'
import { THEME_ORDER } from '@/lib/themes'
import './globals.css'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://monkeyspeak-delta.vercel.app'),
  // favicon from app/icon.png and app/apple-icon.png
  title: 'MonkeySpeak - speaking speed practice',
  description:
    'A small app for practicing speaking speed and checking how clearly your words get transcribed.',
  keywords: ['WPM', 'voice', 'speech', 'speaking practice', 'Deepgram', 'clarity', 'dictation'],
  openGraph: {
    title: 'MonkeySpeak',
    description: 'The voice benchmark. How fast and clearly do you speak?',
    type: 'website',
    url: '/',
    siteName: 'MonkeySpeak',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MonkeySpeak',
    description: 'The voice benchmark. How fast and clearly do you speak?',
  },
}

const THEME_TOKENS = buildThemeTokenMap()
const THEME_VARS_CSS = buildThemeVarsCss(THEME_TOKENS)
const themeBootScript = buildThemeBootScript(THEME_ORDER)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    /*
     * suppressHydrationWarning: the boot script may change data-theme / data-font
     * before React hydrates. That's intentional — we just don't want a console warning.
     */
    <html
      lang="en"
      data-theme="latte"
      data-font="jetbrains"
      data-fontsize="medium"
      suppressHydrationWarning
    >
      <head>
        {/* Palette tokens via data-theme — keeps <html> free of inline style="" */}
        <style id="ms-theme-vars" dangerouslySetInnerHTML={{ __html: THEME_VARS_CSS }} />
        {/*
          Accent default lives in globals.css :root.
          Boot script + applyTheme create/update #ms-accent so React never
          hydrates a localStorage-mutated style tag (that caused the mismatch).
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:ital,wght@0,100..800%3B1,100..800&family=Fira+Code:wght@300..700&family=Inconsolata:wdth,wght@50..200,200..900&display=swap"
        />
      </head>
      <body className="min-h-[100dvh]" style={{ background: 'var(--bg)', color: 'var(--text-active)' }}>
        {children}
      </body>
    </html>
  )
}
