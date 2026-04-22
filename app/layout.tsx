import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
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
    <html lang="en" data-accent="yellow" data-font="jetbrains" data-fontsize="medium">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-active)' }}>
        {children}
      </body>
    </html>
  )
}
