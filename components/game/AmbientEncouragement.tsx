'use client'

import { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'

const MESSAGES = [
  'Nice pace.',
  'Keep going.',
  'Smooth.',
  'Great rhythm.',
  'Strong flow.',
  'Consistent.',
  'Locked in.',
]

interface AmbientEncouragementProps {
  isSpeaking: boolean
  momentum: number
}

export default function AmbientEncouragement({
  isSpeaking,
  momentum,
}: AmbientEncouragementProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLSpanElement>(null)
  const speakingSinceRef = useRef<number | null>(null)
  const lastShownRef = useRef(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isSpeaking) {
      speakingSinceRef.current = null
      return
    }

    if (speakingSinceRef.current === null) {
      speakingSinceRef.current = Date.now()
    }

    const interval = window.setInterval(() => {
      if (!isSpeaking || momentum < 20) return
      const now = Date.now()
      const since = speakingSinceRef.current ?? now
      if (now - since < 5000) return
      if (now - lastShownRef.current < 5000) return

      const pick = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]!
      setMessage(pick)
      lastShownRef.current = now
      speakingSinceRef.current = now
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isSpeaking, momentum])

  useEffect(() => {
    const el = messageRef.current
    if (!el || !message) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
        }
      )
      gsap.to(el, {
        opacity: 0,
        y: -6,
        duration: 0.35,
        ease: 'power2.in',
        delay: 2,
        onComplete: () => setMessage(null),
      })
    }, containerRef)

    return () => ctx.revert()
  }, [message])

  if (!message) return null

  return (
    <div ref={containerRef} className="ambient-encouragement" aria-live="polite">
      <span ref={messageRef} className="ambient-encouragement-msg">
        {message}
      </span>
    </div>
  )
}
