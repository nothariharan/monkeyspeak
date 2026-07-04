'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface MomentumFireProps {
  momentum: number
}

export default function MomentumFire({ momentum }: MomentumFireProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isHigh = momentum >= 50

  useEffect(() => {
    const el = containerRef.current?.querySelector('.momentum-fire-value')
    if (!el) return
    gsap.to(el, { scale: isHigh ? 1.06 : 1, duration: 0.35, ease: 'power2.out' })
  }, [isHigh])

  return (
    <div
      ref={containerRef}
      className="momentum-fire"
      role="status"
      aria-live="polite"
      aria-label={`Speaking momentum ${momentum}`}
    >
      <div className="momentum-fire-core">
        <span className="momentum-fire-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C9 6 6 8 6 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2-1-4-3-6-1 2-2 3-3 3s-2-1-3-3z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="momentum-fire-value tabular-nums">{momentum}</span>
      </div>
      <span className="momentum-fire-label">MOMENTUM</span>
    </div>
  )
}
