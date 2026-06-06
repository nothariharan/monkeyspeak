'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface MomentumMeterProps {
  momentum: number
}

export default function MomentumMeter({ momentum }: MomentumMeterProps) {
  const fillRef = useRef<HTMLDivElement>(null)
  const fillQuickRef = useRef<gsap.QuickToFunc | null>(null)

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return

    gsap.set(fill, { scaleX: 0, transformOrigin: 'left center' })
    fillQuickRef.current = gsap.quickTo(fill, 'scaleX', {
      duration: 0.5,
      ease: 'power2.out',
    })

    return () => {
      fillQuickRef.current = null
    }
  }, [])

  useEffect(() => {
    fillQuickRef.current?.(momentum / 100)
  }, [momentum])

  return (
    <div className="momentum-meter" role="meter" aria-valuenow={momentum} aria-valuemin={0} aria-valuemax={100} aria-label="Speaking momentum">
      <span className="momentum-meter-label">momentum</span>
      <div className="momentum-meter-track">
        <div
          ref={fillRef}
          className="momentum-meter-fill"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}
