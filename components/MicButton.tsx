'use client'

interface MicButtonProps {
  onStart: () => void
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
}

export default function MicButton({ onStart, micState }: MicButtonProps) {
  const isDenied = micState === 'denied' || micState === 'error'
  const isLoading = micState === 'requesting'

  return (
    <div className="flex flex-col items-center gap-4 mt-6">
      {/* Main button */}
      <button
        id="btn-start"
        onClick={() => !isDenied && !isLoading && onStart()}
        disabled={isLoading}
        aria-label="Start test"
        className="relative group focus-visible:outline-none"
        style={{ cursor: isDenied ? 'not-allowed' : 'pointer' }}
      >
        {/* Outer ring pulse */}
        {!isDenied && (
          <span
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              animation: 'mic-ring 1.8s ease-out infinite',
              border: `1px solid var(--accent)`,
            }}
          />
        )}

        {/* Button circle */}
        <div
          className="relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200"
          style={{
            border: `2px solid ${isDenied ? 'var(--error)' : 'var(--accent)'}`,
            background: isDenied ? 'rgba(202,71,84,0.08)' : 'transparent',
          }}
        >
          {isLoading ? (
            /* Spinner */
            <svg
              className="animate-spin"
              width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: 'var(--text-stats)' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : isDenied ? (
            /* Denied icon */
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--error)' }}
            >
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            /* Mic icon */
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--accent)' }}
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </div>
      </button>

      {/* Caption */}
      <p className="text-xs lowercase tracking-wide" style={{ color: 'var(--text-stats)' }}>
        {isDenied
          ? 'microphone access denied — check browser permissions'
          : isLoading
          ? 'requesting microphone access…'
          : 'press enter or click to start'}
      </p>
    </div>
  )
}
