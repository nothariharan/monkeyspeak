/**
 * Convert float32 mic samples to linear16 PCM at 16 kHz for Deepgram streaming.
 * If the AudioContext runs at another rate (common: 44100 / 48000), linearly
 * resamples so the bytes match `sample_rate=16000` on the listen URL.
 */
export function float32ToLinear16Pcm16k(input: Float32Array, inputSampleRate: number): Int16Array {
  const outRate = 16000
  if (inputSampleRate === outRate) {
    const int16 = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)))
    }
    return int16
  }

  const ratio = inputSampleRate / outRate
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const int16 = new Int16Array(outLen)

  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio
    const i0 = Math.floor(srcPos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = srcPos - i0
    const s = input[i0]! * (1 - frac) + input[i1]! * frac
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)))
  }
  return int16
}
