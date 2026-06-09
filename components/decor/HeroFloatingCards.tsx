'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { gsap } from 'gsap'

type CardTone = 'green' | 'purple' | 'orange' | 'blue'
type CardPosition = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right'

interface FloatingCard {
  position: CardPosition
  tone: CardTone
  title: string
  stat: string
  body: string
  icon: ReactNode
}

const cards: FloatingCard[] = [
  {
    position: 'top-left',
    tone: 'green',
    title: 'Average human',
    stat: '110 WPM',
    body: "That's around 150 words per minute.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
  {
    position: 'bottom-left',
    tone: 'purple',
    title: 'Top 1% people',
    stat: '180+ WPM',
    body: 'Can you reach the top?',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5a3 3 0 0 0 3 3" />
        <path d="M16 6h3a3 3 0 0 1-3 3" />
        <path d="M12 11v5" />
        <path d="M8 20h8" />
        <path d="M10 16h4" />
      </svg>
    ),
  },
  {
    position: 'top-right',
    tone: 'orange',
    title: 'Fast speakers are',
    stat: 'more persuasive.',
    body: '',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 17 10 11l4 4 6-8" />
        <path d="M14 7h6v6" />
      </svg>
    ),
  },
  {
    position: 'bottom-right',
    tone: 'blue',
    title: 'Your voice is',
    stat: 'faster',
    body: 'than you think.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    ),
  },
]

export default function HeroFloatingCards() {
  const rootRef = useRef<HTMLDivElement>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: reduce)', () => {
      reducedRef.current = true
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      reducedRef.current = false

      gsap.from(root.querySelectorAll('.hero-floating-card'), {
        opacity: 0,
        y: 18,
        scale: 0.92,
        stagger: 0.08,
        duration: 0.55,
        ease: 'power2.out',
        delay: 0.25,
      })

      root.querySelectorAll('.hero-floating-card').forEach((el, i) => {
        gsap.to(el, {
          y: i % 2 === 0 ? -7 : 7,
          x: i % 2 === 0 ? 4 : -4,
          duration: 2.8 + i * 0.25,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.16,
        })
      })
    })

    return () => mm.revert()
  }, [])

  const wiggle = (target: HTMLDivElement | null) => {
    if (!target || reducedRef.current) return
    gsap.fromTo(
      target,
      { rotate: Number(target.dataset.baseRotate ?? 0) - 3 },
      {
        rotate: Number(target.dataset.baseRotate ?? 0) + 4,
        duration: 0.12,
        yoyo: true,
        repeat: 3,
        ease: 'sine.inOut',
      }
    )
  }

  return (
    <div ref={rootRef} className="hero-floating-cards" aria-hidden>
      {cards.map((card) => {
        const baseRotate =
          card.position === 'top-left' ? -4 :
          card.position === 'bottom-left' ? -3 :
          card.position === 'top-right' ? 3 :
          2

        return (
          <div
            key={card.position}
            className={`hero-floating-card hero-floating-card--${card.position} hero-floating-card--${card.tone}`}
            data-base-rotate={baseRotate}
            onMouseEnter={(event) => wiggle(event.currentTarget)}
          >
            <div className="hero-floating-card-icon">{card.icon}</div>
            <div className="hero-floating-card-copy">
              <span className="hero-floating-card-title">{card.title}</span>
              <strong>{card.stat}</strong>
              {card.body && <span className="hero-floating-card-body">{card.body}</span>}
            </div>
            <span className="hero-floating-card-spark" />
          </div>
        )
      })}
    </div>
  )
}
