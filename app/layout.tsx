import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'MonkeySpeak — Voice Speed & Clarity Benchmark',
  description:
    'Measure how fast and accurately you speak. MonkeySpeak is the spoken equivalent of MonkeyType — real-time WPM tracking via Deepgram and word-level clarity scoring.',
  keywords: ['WPM', 'voice', 'speech', 'benchmark', 'Deepgram', 'clarity', 'dictation'],
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
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-active)' }}>
        {children}
      </body>
    </html>
  )
}
