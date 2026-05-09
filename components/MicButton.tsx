'use client'

interface MicButtonProps {
  onStart: () => void
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
}

export default function MicButton({ onStart, micState }: MicButtonProps) {
  const isDenied = micState === 'denied' || micState === 'error'
  const isLoading = micState === 'requesting'

  return (
    <div className="flex w-full justify-center">
      <button
        type="button"
        id="btn-start"
        onClick={() => !isDenied && !isLoading && onStart()}
        disabled={isLoading}
        aria-label="Start test"
        className="font-mono text-sm lowercase tracking-wide bg-transparent border-0 py-2 px-3 rounded-md transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] focus-visible:ring-[var(--accent)]"
        style={{
          color: isDenied ? 'var(--error)' : 'var(--text-stats)',
          cursor: isDenied ? 'not-allowed' : isLoading ? 'wait' : 'pointer',
        }}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2 justify-center">
            <svg
              className="animate-spin shrink-0"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            requesting microphone access…
          </span>
        ) : isDenied ? (
          'microphone access denied — check browser permissions'
        ) : (
          'press enter or click to start'
        )}
      </button>
    </div>
  )
}
