'use client'

import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface AmbientEnvironmentProps {
  energy: number
}

const FLOATERS = [
  { left: '8%', top: '15%', size: 12, delay: 0 },
  { left: '85%', top: '20%', size: 8, delay: 0.5 },
  { left: '20%', top: '70%', size: 10, delay: 1 },
  { left: '75%', top: '65%', size: 14, delay: 0.3 },
  { left: '50%', top: '10%', size: 6, delay: 0.8 },
  { left: '35%', top: '80%', size: 9, delay: 1.2 },
  { left: '92%', top: '45%', size: 7, delay: 0.6 },
  { left: '5%', top: '50%', size: 11, delay: 1.5 },
]

export default function AmbientEnvironment({ energy }: AmbientEnvironmentProps) {
  const envRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const env = envRef.current
    if (!env) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const floaters = env.querySelectorAll('.ambient-floater')
      floaters.forEach((el, i) => {
        gsap.to(el, {
          y: '+=12',
          x: i % 2 === 0 ? '+=6' : '-=6',
          duration: 3 + (i % 3),
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: FLOATERS[i]?.delay ?? 0,
        })
      })
    })

    return () => mm.revert()
  }, [])

  useEffect(() => {
    const env = envRef.current
    if (!env) return
    const opacity = 0.15 + energy * 0.35
    env.style.setProperty('--ambient-opacity', String(opacity))
  }, [energy])

  return (
    <div ref={envRef} className="ambient-environment" aria-hidden>
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className={`ambient-floater ambient-floater--${i % 3}`}
          style={{
            left: f.left,
            top: f.top,
            width: f.size,
            height: f.size,
          }}
        />
      ))}
      <span className="ambient-blob ambient-blob--1" />
      <span className="ambient-blob ambient-blob--2" />
      <span className="ambient-doodle ambient-doodle--1">~</span>
      <span className="ambient-doodle ambient-doodle--2">+</span>
      <span className="ambient-bubble ambient-bubble--1" />
      <span className="ambient-bubble ambient-bubble--2" />
    </div>
  )
}
