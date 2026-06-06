'use client'

interface DoodleAnnotationsProps {
  showIdle?: boolean
}

export default function DoodleAnnotations({ showIdle = true }: DoodleAnnotationsProps) {
  if (!showIdle) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {/* Blue squiggle */}
      <svg
        className="absolute -left-4 top-8 hidden md:block"
        width="80"
        height="40"
        viewBox="0 0 80 40"
        fill="none"
      >
        <path
          d="M5 25 Q20 5 40 20 T75 15"
          stroke="var(--accent)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {/* Green speech bubble - let's go! */}
      <div
        className="absolute -right-2 top-4 hidden sm:flex items-center"
        style={{
          background: 'var(--success)',
          border: '2px solid var(--border)',
          boxShadow: '3px 3px 0 var(--shadow)',
          padding: '0.35rem 0.75rem',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '0.7rem',
          color: '#fff',
          textTransform: 'lowercase',
        }}
      >
        let&apos;s go!
      </div>

      {/* Click to start speaking arrow */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%-2rem)] flex flex-col items-center gap-1 hidden lg:flex">
        <svg width="60" height="50" viewBox="0 0 60 50" fill="none">
          <path
            d="M10 5 Q30 25 30 40"
            stroke="var(--border)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M24 38 L30 45 L36 38" stroke="var(--border)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-stats)',
            letterSpacing: '0.04em',
          }}
        >
          Click to start speaking
        </span>
      </div>

      {/* zzz doodle */}
      <span
        className="absolute right-8 bottom-12 hidden md:block"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1.25rem',
          color: 'var(--text-muted)',
          transform: 'rotate(-12deg)',
        }}
      >
        zzz
      </span>

      {/* Curved arrow */}
      <svg
        className="absolute left-12 bottom-20 hidden lg:block"
        width="50"
        height="40"
        viewBox="0 0 50 40"
        fill="none"
      >
        <path
          d="M5 35 Q25 5 45 15"
          stroke="var(--accent)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M38 10 L45 15 L40 22" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}
