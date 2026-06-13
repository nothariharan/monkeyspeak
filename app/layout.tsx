import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  title: 'MonkeySpeak - speaking speed practice',
  description:
    'A small app for practicing speaking speed and checking how clearly your words get transcribed.',
  keywords: ['WPM', 'voice', 'speech', 'speaking practice', 'Deepgram', 'clarity', 'dictation'],
  openGraph: {
    title: 'MonkeySpeak',
    description: 'The voice benchmark. How fast and clearly do you speak?',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="latte" data-accent="blue" data-font="jetbrains" data-fontsize="medium">
      <head>
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
