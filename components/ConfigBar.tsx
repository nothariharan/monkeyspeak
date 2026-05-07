'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useTestStore } from '@/store/testStore'
import type { Duration, PromptType } from '@/store/testStore'
import type { ProviderType } from '@/hooks/useSpeechProvider'
import { prefetchDeepgramKey } from '@/hooks/useDeepgramProvider'

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

const ANIM = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

const PROVIDERS: { label: string; value: ProviderType }[] = [
  { label: 'browser', value: 'webspeech' },
  { label: 'deepgram', value: 'deepgram' },
]

export default function ConfigBar() {
  const {
    mode, duration, promptType, customPromptText, testState, settings, setSttProvider,
    setDuration, setPromptType, setCustomPromptText,
  } = useTestStore()

  const isRunning = testState === 'running'
  const currentProvider = settings.sttProvider ?? 'webspeech'

  const handleProviderChange = (p: ProviderType) => {
    if (isRunning) return
    setSttProvider(p)
    if (p === 'deepgram') {
      // Pre-fetch token immediately so it's warm when the user clicks start
      prefetchDeepgramKey()
    }
  }

  const promptOptions = mode === 'speed' ? SPEED_PROMPTS : CLARITY_PROMPTS

  return (
    <motion.div {...ANIM} className="flex flex-col items-center gap-3 py-4 px-6">
      <div className="flex flex-wrap items-center justify-center gap-6">
        {/* Timer group — Speed only */}
        {mode === 'speed' && (
          <div className="flex items-center gap-1" role="group" aria-label="Duration">
            {SPEED_DURATIONS.map((d) => (
              <button
                key={d}
                id={`duration-${d}`}
                className={`pill-btn ${duration === d ? 'active' : ''}`}
                onClick={() => setDuration(d)}
                aria-pressed={duration === d}
              >
                {d}s
              </button>
            ))}
          </div>
        )}

        {/* Separator */}
        {mode === 'speed' && (
          <span style={{ color: 'var(--text-muted)' }}>|</span>
        )}

        {/* Prompt type group */}
        <div className="flex items-center gap-1" role="group" aria-label="Prompt type">
          {promptOptions.map((opt) => (
            <button
              key={opt.value}
              id={`prompt-${opt.value}`}
              className={`pill-btn ${promptType === opt.value ? 'active' : ''}`}
              onClick={() => setPromptType(opt.value)}
              aria-pressed={promptType === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* STT provider toggle — Speed mode only */}
      {mode === 'speed' && (
        <div
          className="flex items-center gap-2"
          style={{ marginTop: '0.25rem' }}
          role="group"
          aria-label="Speech-to-text provider"
        >
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
              letterSpacing: '0.06em',
              userSelect: 'none',
            }}
          >
            stt
          </span>

          {PROVIDERS.map((p) => {
            const isActive = currentProvider === p.value
            return (
              <button
                key={p.value}
                id={`stt-provider-${p.value}`}
                onClick={() => handleProviderChange(p.value)}
                disabled={isRunning}
                aria-pressed={isActive}
                aria-label={`Use ${p.label} for speech recognition`}
                style={{
                  fontFamily: 'var(--font-mono), ui-monospace, monospace',
                  fontSize: '0.68rem',
                  letterSpacing: '0.04em',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--text-muted)'}`,
                  background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunning ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                  lineHeight: '1.6',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Custom text input */}
      <AnimatePresence>
        {promptType === 'custom' && (
          <motion.div
            key="custom-input"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2 } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
            className="w-full max-w-2xl overflow-hidden"
          >
            <textarea
              id="custom-text-input"
              className="clarity-input mt-2"
              rows={3}
              placeholder="paste your custom text here…"
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              aria-label="Custom prompt text"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
