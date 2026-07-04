'use client'

import { useEffect, useState } from 'react'
import type { ProviderType } from '@/hooks/useSpeechProvider'

// live stt indicator in the game hud — shows provider + listening/degraded/error

interface SttStatusBadgeProps {
  activeSource: ProviderType
  isListening: boolean
  sttError?: string | null
  hasWords: boolean
}

type BadgeVariant = 'deepgram' | 'webspeech' | 'degraded' | 'error'

const DEGRADED_DELAY_MS = 6000

const LABELS: Record<BadgeVariant, string> = {
  deepgram: 'dg',
  webspeech: 'ws',
  degraded: '~',
  error: '!',
}

const TITLES: Record<BadgeVariant, string> = {
  deepgram: 'Deepgram connected',
  webspeech: 'Browser speech active',
  degraded: 'No words detected — speak louder or check mic input',
  error: 'STT error',
}

export default function SttStatusBadge({ activeSource, isListening, sttError, hasWords }: SttStatusBadgeProps) {
  const [degraded, setDegraded] = useState(false)

  useEffect(() => {
    if (!isListening || hasWords) { setDegraded(false); return }
    const t = window.setTimeout(() => setDegraded(true), DEGRADED_DELAY_MS)
    return () => clearTimeout(t)
  }, [isListening, hasWords])

  useEffect(() => {
    if (hasWords) setDegraded(false)
  }, [hasWords])

  let variant: BadgeVariant | null = null
  if (sttError) {
    variant = 'error'
  } else if (isListening && degraded) {
    variant = 'degraded'
  } else if (isListening) {
    variant = activeSource
  }

  if (!variant) return null

  const colorMap: Record<BadgeVariant, string> = {
    deepgram: '#22c55e',
    webspeech: 'var(--accent)',
    degraded: '#f59e0b',
    error: 'var(--error)',
  }
  const color = colorMap[variant]

  return (
    <span
      title={variant === 'error' ? `STT error: ${sttError}` : TITLES[variant]}
      aria-label={variant === 'error' ? `STT error: ${sttError}` : TITLES[variant]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.12rem 0.42rem',
        borderRadius: '9999px',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.62rem',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.05em',
        opacity: 0.75,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: '0.42rem',
          height: '0.42rem',
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {LABELS[variant]}
    </span>
  )
}
