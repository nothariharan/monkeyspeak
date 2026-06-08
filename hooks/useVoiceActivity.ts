'use client'

import { useRef, useState, useEffect, type MutableRefObject } from 'react'

export interface VoiceActivityState {
  energy: number
  isSpeaking: boolean
  /** Mutable ref updated every animation frame — read in canvas loops, not React state. */
  frequencyBinsRef: MutableRefObject<Uint8Array>
}

const SPEAK_THRESHOLD = 0.06

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
}: UseVoiceActivityOptions): VoiceActivityState {
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const [energy, setEnergy] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const frequencyBinsRef = useRef<Uint8Array>(new Uint8Array(0))
  const frameCountRef = useRef(0)

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

  useEffect(() => {
    if (!isActive) {
      setEnergy(0)
      setIsSpeaking(false)
      frequencyBinsRef.current = new Uint8Array(0)
      return
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const tick = () => {
      const analyser = analyserRef.current
      const freqData = dataArrayRef.current
      const timeData = timeDataRef.current

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

      if (speaking && audioCtxRef.current?.state === 'suspended') {
        void audioCtxRef.current.resume()
      }

      frameCountRef.current++
      if (frameCountRef.current % 4 === 0) {
        setEnergy(currentEnergy)
        setIsSpeaking(speaking)
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
  }, [isActive])

  return {
    energy,
    isSpeaking,
    frequencyBinsRef,
  }
}
