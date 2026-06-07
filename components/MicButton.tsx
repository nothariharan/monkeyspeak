'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface MicButtonProps {
  onStart: () => void
  micState: 'idle' | 'requesting' | 'active' | 'denied' | 'error'
  onHoverChange?: (hovered: boolean) => void
}

export default function MicButton({ onStart, micState, onHoverChange }: MicButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDenied = micState === 'denied' || micState === 'error'
  const isLoading = micState === 'requesting'

  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(containerRef.current, {
        scale: 0.8,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.7)',
        delay: 0.2,
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 w-full">
      <button
        type="button"
        id="btn-start"
        onClick={() => !isDenied && !isLoading && onStart()}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        onFocus={() => onHoverChange?.(true)}
        onBlur={() => onHoverChange?.(false)}
        disabled={isLoading || isDenied}
        aria-label="Start test"
        className="relative flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: isDenied ? 'var(--error)' : 'var(--accent)',
          border: 'none',
          boxShadow: 'var(--shadow-accent)',
          cursor: isDenied ? 'not-allowed' : isLoading ? 'wait' : 'pointer',
        }}
      >
        {isLoading ? (
          <svg
            className="animate-spin"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#fff" />
            <path d="M5 11a7 7 0 0 0 14 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="8" y1="22" x2="16" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <p
        className="font-mono text-xs text-center max-w-xs"
        style={{ color: isDenied ? 'var(--error)' : 'var(--text-stats)' }}
      >
        {isLoading
          ? 'requesting microphone access…'
          : isDenied
            ? 'microphone access denied — check browser permissions'
            : 'press enter or click to start'}
      </p>
    </div>
  )
}
