'use client'

import { useRef, useState, useEffect, type MutableRefObject } from 'react'

export type CompanionState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'excited'
  | 'sleepy'
  | 'celebrating'

export interface VoiceActivityState {
  energy: number
  isSpeaking: boolean
  momentum: number
  companionState: CompanionState
  silenceDuration: number
  /** Mutable ref updated every animation frame — read in canvas loops, not React state. */
  frequencyBinsRef: MutableRefObject<Uint8Array>
}

const SPEAK_THRESHOLD = 0.06
const MOMENTUM_GAIN = 2
const MOMENTUM_DRAIN = 0.5
const SLEEPY_MS = 3000
const EXCITED_MOMENTUM = 70
const EXCITED_ENERGY = 0.35

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

interface UseVoiceActivityOptions {
  micStream: MediaStream | null
  isActive: boolean
  isEnding?: boolean
}

export function useVoiceActivity({
  micStream,
  isActive,
  isEnding = false,
}: UseVoiceActivityOptions): VoiceActivityState {
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const momentumRef = useRef(0)
  const lastSpeechRef = useRef<number | null>(null)
  const hasSpokenRef = useRef(false)

  const [energy, setEnergy] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [momentum, setMomentum] = useState(0)
  const [companionState, setCompanionState] = useState<CompanionState>('idle')
  const [silenceDuration, setSilenceDuration] = useState(0)
  const frequencyBinsRef = useRef<Uint8Array>(new Uint8Array(0))
  const frameCountRef = useRef(0)

  // WebAudio setup
  useEffect(() => {
    if (!micStream || !isActive) {
      analyserRef.current = null
      dataArrayRef.current = null
      timeDataRef.current = null
      return
    }

    const AudioContextCtor =
      window.AudioContext || (window as AudioContextWindow).webkitAudioContext
    if (!AudioContextCtor) return

    const audioCtx = new AudioContextCtor()
    const source = audioCtx.createMediaStreamSource(micStream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)

    audioCtxRef.current = audioCtx
    analyserRef.current = analyser
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
    timeDataRef.current = new Uint8Array(analyser.fftSize)

    if (audioCtx.state === 'suspended') void audioCtx.resume()

    return () => {
      source.disconnect()
      analyser.disconnect()
      analyserRef.current = null
      dataArrayRef.current = null
      timeDataRef.current = null
      audioCtxRef.current = null
      void audioCtx.close()
    }
  }, [micStream, isActive])

  // Reset on session start
  useEffect(() => {
    if (!isActive) {
      momentumRef.current = 0
      lastSpeechRef.current = null
      hasSpokenRef.current = false
      setEnergy(0)
      setIsSpeaking(false)
      setMomentum(0)
      setCompanionState('idle')
      setSilenceDuration(0)
      frequencyBinsRef.current = new Uint8Array(0)
      return
    }
    lastSpeechRef.current = Date.now()
  }, [isActive])

  // Celebration override
  useEffect(() => {
    if (isEnding) {
      setCompanionState('celebrating')
    }
  }, [isEnding])

  // Animation loop
  useEffect(() => {
    if (!isActive || isEnding) return

    const tick = () => {
      const analyser = analyserRef.current
      const freqData = dataArrayRef.current
      const timeData = timeDataRef.current
      const now = Date.now()

      let rms = 0
      if (analyser && timeData) {
        analyser.getByteTimeDomainData(timeData)
        let sumSq = 0
        for (let i = 0; i < timeData.length; i++) {
          const x = (timeData[i]! - 128) / 128
          sumSq += x * x
        }
        rms = Math.sqrt(sumSq / timeData.length)
      }

      const currentEnergy = Math.min(1, rms * 5.2)
      const speaking = currentEnergy > SPEAK_THRESHOLD

      if (speaking) {
        lastSpeechRef.current = now
        hasSpokenRef.current = true
      }

      const silence = speaking
        ? 0
        : lastSpeechRef.current
          ? now - lastSpeechRef.current
          : 0

      if (speaking) {
        momentumRef.current = Math.min(100, momentumRef.current + MOMENTUM_GAIN)
      } else {
        momentumRef.current = Math.max(0, momentumRef.current - MOMENTUM_DRAIN)
      }

      let state: CompanionState = 'idle'
      if (silence > SLEEPY_MS && hasSpokenRef.current) {
        state = 'sleepy'
      } else if (
        momentumRef.current > EXCITED_MOMENTUM &&
        currentEnergy > EXCITED_ENERGY
      ) {
        state = 'excited'
      } else if (speaking) {
        state = 'speaking'
      } else if (hasSpokenRef.current) {
        state = 'listening'
      } else {
        state = 'idle'
      }

      frameCountRef.current++
      const shouldUpdateState = frameCountRef.current % 4 === 0

      if (shouldUpdateState) {
        setEnergy(currentEnergy)
        setIsSpeaking(speaking)
        setMomentum(Math.round(momentumRef.current))
        setCompanionState(state)
        setSilenceDuration(silence)
      }

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        frequencyBinsRef.current = freqData
      }

      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [isActive, isEnding])

  return {
    energy,
    isSpeaking,
    momentum,
    companionState,
    silenceDuration,
    frequencyBinsRef,
  }
}
