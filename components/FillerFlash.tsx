'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTestStore } from '@/store/testStore'

interface FillerFlashProps {
  trigger: number
  isWarning: boolean
}

/**
 * Transparent overlay that pulses purple on filler detection,
 * shifting to amber if 3+ fillers detected in a 10-second window.
 * Also shows the "+1 filler" pill notification.
 */
export default function FillerFlash({ trigger, isWarning }: FillerFlashProps) {
  const { settings } = useTestStore()
  const prevTrigger = useRef(trigger)
  const flashKey = useRef(0)

  if (trigger !== prevTrigger.current) {
    prevTrigger.current = trigger
    flashKey.current += 1
  }

  if (!settings.fillerFlash || trigger === 0) return null

  const color = isWarning
    ? 'rgba(245, 158, 11, 0.10)'
    : 'rgba(139, 92, 246, 0.10)'

  return (
    <>
      {/* Background pulse */}
      <AnimatePresence>
        <motion.div
          key={`flash-${flashKey.current}`}
          className="absolute inset-0 rounded-lg pointer-events-none z-10"
          initial={{ backgroundColor: 'transparent' }}
          animate={{ backgroundColor: [color, 'transparent'] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {/* "+1 filler" pill */}
      <AnimatePresence>
        <motion.div
          key={`pill-${flashKey.current}`}
          className="absolute top-3 right-3 z-20 pointer-events-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.5, 1] }}
            className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{
              background: isWarning ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)',
              color: isWarning ? '#f59e0b' : '#a78bfa',
              border: `1px solid ${isWarning ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`,
            }}
          >
            +1 filler
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
