import { ImageResponse } from 'next/og'

// Branded social share card, rendered at request time by the Edge runtime.
export const runtime = 'edge'
export const alt = 'MonkeySpeak — the voice speed benchmark'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f2ea',
          color: '#111111',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* brutalist corner frame */}
        <div
          style={{
            position: 'absolute',
            inset: 40,
            border: '6px solid #111111',
            borderRadius: 24,
          }}
        />
        <div style={{ fontSize: 140, marginBottom: 8 }}>🙊</div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: '-4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          MonkeySpeak
          <span style={{ color: '#3b82f6', marginLeft: 12 }}>⚡</span>
        </div>
        <div
          style={{
            fontSize: 36,
            marginTop: 16,
            color: '#666666',
          }}
        >
          how fast can you speak?
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 48,
            fontSize: 26,
            color: '#111111',
          }}
        >
          <span style={{ padding: '10px 24px', border: '3px solid #111111', borderRadius: 999 }}>
            live WPM
          </span>
          <span style={{ padding: '10px 24px', border: '3px solid #111111', borderRadius: 999 }}>
            clarity score
          </span>
          <span style={{ padding: '10px 24px', border: '3px solid #111111', borderRadius: 999 }}>
            leaderboard
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
