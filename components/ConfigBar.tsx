'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useTestStore } from '@/store/testStore'
import { shouldPreferDeepgramStt } from '@/lib/browserSpeech'
import type { Duration, PromptType, EndCondition, PromptDifficulty } from '@/store/testStore'
import type { ProviderType } from '@/hooks/useSpeechProvider'

const SPEED_DURATIONS: Duration[] = [15, 30, 60, 120]
const SPEED_PROMPTS:  { label: string; value: PromptType }[] = [
  { label: 'sentences', value: 'sentences' },
  { label: 'numbers',   value: 'numbers' },
  { label: 'daily challenge', value: 'daily' },
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

const END_CONDITIONS: { label: string; value: EndCondition }[] = [
  { label: 'timed', value: 'timer' },
  { label: 'passage', value: 'passage' },
]

const DIFFICULTIES: { label: string; value: PromptDifficulty }[] = [
  { label: 'easy', value: 'easy' },
  { label: 'normal', value: 'normal' },
  { label: 'hard', value: 'hard' },
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
      <div className="choice-strip flex flex-wrap justify-center">{children}</div>
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
        background: active ? 'var(--accent)' : 'transparent',
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
    setDuration, setPromptType, setCustomPromptText, updateSettings,
  } = useTestStore()

  const endCondition = settings.endCondition ?? 'timer'
  const promptDifficulty = settings.promptDifficulty ?? 'normal'

  const [recommendDeepgram, setRecommendDeepgram] = useState(false)

  const isRunning = testState === 'running'
  const currentProvider = settings.sttProvider ?? 'webspeech'
  const isRaceMode = mode === 'speed' || mode === 'ghost'
  const promptOptions = isRaceMode ? SPEED_PROMPTS : CLARITY_PROMPTS

  useEffect(() => {
    void shouldPreferDeepgramStt().then(setRecommendDeepgram)
  }, [])

  useEffect(() => {
    if (!barRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(barRef.current, { opacity: 0, y: -12, duration: 0.35, ease: 'power2.out' })
    }, barRef)
    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={barRef}
      data-mode={mode}
      className={`hero-preflight flex flex-col items-center px-6 ${
        mode === 'clarity'
          ? 'hero-preflight--clarity gap-2 py-1.5'
          : mode === 'ghost'
            ? 'hero-preflight--ghost gap-4 py-3'
            : 'gap-4 py-3'
      }`}
    >
      <div
        className={`hero-preflight-groups flex flex-wrap items-start justify-center ${
          mode === 'clarity' ? 'gap-3' : 'gap-6'
        }`}
      >
        {isRaceMode && (
          <SegmentGroup label="duration">
            {SPEED_DURATIONS.map((d) => (
              <SegmentBtn
                key={d}
                id={`duration-${d}`}
                active={duration === d}
                disabled={promptType === 'daily' && d !== 30}
                onClick={() => setDuration(d)}
              >
                {d}s
              </SegmentBtn>
            ))}
          </SegmentGroup>
        )}

        <SegmentGroup label={mode === 'clarity' ? 'board prompt' : 'prompt'}>
          {promptOptions.map((opt) => (
            <SegmentBtn
              key={opt.value}
              id={`prompt-${opt.value}`}
              active={promptType === opt.value}
              onClick={() => {
                setPromptType(opt.value)
                if (opt.value === 'daily') {
                  setDuration(30)
                }
              }}
            >
              {opt.label}
            </SegmentBtn>
          ))}
        </SegmentGroup>

        {mode === 'ghost' ? (
          <details className="hero-preflight-more">
            <summary>more options</summary>
            <div className="hero-preflight-more-body">
              <SegmentGroup label="end">
                {END_CONDITIONS.map((ec) => (
                  <SegmentBtn
                    key={ec.value}
                    id={`end-${ec.value}`}
                    active={promptType === 'daily' ? ec.value === 'timer' : endCondition === ec.value}
                    disabled={isRunning || promptType === 'daily'}
                    onClick={() => !isRunning && updateSettings({ endCondition: ec.value })}
                  >
                    {ec.label}
                  </SegmentBtn>
                ))}
              </SegmentGroup>

              {promptType === 'sentences' && (
                <SegmentGroup label="difficulty">
                  {DIFFICULTIES.map((d) => (
                    <SegmentBtn
                      key={d.value}
                      id={`difficulty-${d.value}`}
                      active={promptDifficulty === d.value}
                      disabled={isRunning}
                      onClick={() => !isRunning && updateSettings({ promptDifficulty: d.value })}
                    >
                      {d.label}
                    </SegmentBtn>
                  ))}
                </SegmentGroup>
              )}

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
            </div>
          </details>
        ) : (
          <>
            {isRaceMode && (
              <SegmentGroup label="end">
                {END_CONDITIONS.map((ec) => (
                  <SegmentBtn
                    key={ec.value}
                    id={`end-${ec.value}`}
                    active={promptType === 'daily' ? ec.value === 'timer' : endCondition === ec.value}
                    disabled={isRunning || promptType === 'daily'}
                    onClick={() => !isRunning && updateSettings({ endCondition: ec.value })}
                  >
                    {ec.label}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            )}

            {isRaceMode && promptType === 'sentences' && (
              <SegmentGroup label="difficulty">
                {DIFFICULTIES.map((d) => (
                  <SegmentBtn
                    key={d.value}
                    id={`difficulty-${d.value}`}
                    active={promptDifficulty === d.value}
                    disabled={isRunning}
                    onClick={() => !isRunning && updateSettings({ promptDifficulty: d.value })}
                  >
                    {d.label}
                  </SegmentBtn>
                ))}
              </SegmentGroup>
            )}

            {isRaceMode && (
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
          </>
        )}
      </div>

      {isRaceMode && recommendDeepgram && currentProvider === 'webspeech' && !isRunning && (
        <p className="text-center text-xs text-[var(--text-stats)] max-w-md hero-preflight-tip">
          if browser speech feels stuck, try deepgram mode or switch to chrome for the quick test.
        </p>
      )}

      {promptType === 'custom' && (
        <div key={`custom-prompt-${mode}`} className="w-full max-w-2xl">
          <textarea
            id="custom-text-input"
            className="clarity-input mt-2"
            rows={3}
            placeholder="paste your custom text here..."
            value={customPromptText}
            onChange={(e) => setCustomPromptText(e.target.value)}
            aria-label="Custom prompt text"
          />
        </div>
      )}
    </div>
  )
}
