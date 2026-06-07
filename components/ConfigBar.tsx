'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useTestStore } from '@/store/testStore'
import type { Duration, PromptType } from '@/store/testStore'
import type { ProviderType } from '@/hooks/useSpeechProvider'

const SPEED_DURATIONS: Duration[] = [15, 30, 60, 120]
const SPEED_PROMPTS:  { label: string; value: PromptType }[] = [
  { label: 'sentences', value: 'sentences' },
  { label: 'numbers',   value: 'numbers' },
  { label: 'custom',    value: 'custom' },
]
const CLARITY_PROMPTS: { label: string; value: PromptType }[] = [
  { label: 'sentences',       value: 'sentences' },
  { label: 'technical',       value: 'technical' },
  { label: 'tongue twisters', value: 'tongue-twisters' },
  { label: 'custom',          value: 'custom' },
]

const PROVIDERS: { label: string; value: ProviderType }[] = [
  { label: 'browser', value: 'webspeech' },
  { label: 'deepgram', value: 'deepgram' },
]

function SegmentGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="stat-label">{label}</span>
      <div className="clean-segment flex flex-wrap justify-center">{children}</div>
    </div>
  )
}

function SegmentBtn({
  active,
  onClick,
  disabled,
  id,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  id: string
  children: React.ReactNode
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="mode-tab"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-stats)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function ConfigBar() {
  const barRef = useRef<HTMLDivElement>(null)
  const {
    mode, duration, promptType, customPromptText, testState, settings, setSttProvider,
    setDuration, setPromptType, setCustomPromptText,
  } = useTestStore()

  const isRunning = testState === 'running'
  const currentProvider = settings.sttProvider ?? 'webspeech'
  const promptOptions = mode === 'speed' ? SPEED_PROMPTS : CLARITY_PROMPTS

  useEffect(() => {
    if (!barRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(barRef.current, { opacity: 0, y: -12, duration: 0.35, ease: 'power2.out' })
    }, barRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={barRef} className="flex flex-col items-center gap-5 py-4 px-6">
      <div className="flex flex-wrap items-start justify-center gap-6">
        {mode === 'speed' && (
          <SegmentGroup label="duration">
            {SPEED_DURATIONS.map((d) => (
              <SegmentBtn
                key={d}
                id={`duration-${d}`}
                active={duration === d}
                onClick={() => setDuration(d)}
              >
                {d}s
              </SegmentBtn>
            ))}
          </SegmentGroup>
        )}

        <SegmentGroup label="prompt">
          {promptOptions.map((opt) => (
            <SegmentBtn
              key={opt.value}
              id={`prompt-${opt.value}`}
              active={promptType === opt.value}
              onClick={() => setPromptType(opt.value)}
            >
              {opt.label}
            </SegmentBtn>
          ))}
        </SegmentGroup>

        {mode === 'speed' && (
          <SegmentGroup label="stt">
            {PROVIDERS.map((p) => (
              <SegmentBtn
                key={p.value}
                id={`stt-provider-${p.value}`}
                active={currentProvider === p.value}
                disabled={isRunning}
                onClick={() => !isRunning && setSttProvider(p.value)}
              >
                {p.label}
              </SegmentBtn>
            ))}
          </SegmentGroup>
        )}
      </div>

      {promptType === 'custom' && (
        <div className="w-full max-w-2xl">
          <textarea
            id="custom-text-input"
            className="clarity-input mt-2"
            rows={3}
            placeholder="paste your custom text here…"
            value={customPromptText}
            onChange={(e) => setCustomPromptText(e.target.value)}
            aria-label="Custom prompt text"
          />
        </div>
      )}
    </div>
  )
}
