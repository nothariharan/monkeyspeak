/**
 * Silero VAD Web Worker
 *
 * Receives raw Float32Array PCM chunks (16 kHz mono) from the main thread,
 * buffers them into 512-sample (32ms) frames, runs each frame through the
 * Silero v5 ONNX model, and posts:
 *
 *   { type: 'ready' }                       — model loaded
 *   { type: 'audio',  buffer: ArrayBuffer } — voiced PCM frame (transferable)
 *   { type: 'speech_start', timestamp: ms } — first voiced frame after silence
 *   { type: 'speech_end',   timestamp: ms } — silence long enough to close utterance
 *
 * The main thread feeds voiced frames directly to the Deepgram WebSocket,
 * eliminating ~100-150ms of silence that would otherwise delay Deepgram's
 * utterance_end finalisation.
 */

/* global ort */
importScripts('./ort.min.js')

// Disable multi-threading — avoids the SharedArrayBuffer / COOP+COEP requirement.
// ort-wasm-simd-threaded.wasm is still used, but with numThreads=1 ORT skips
// the SAB-backed thread pool and falls back to synchronous single-core WASM.
ort.env.wasm.numThreads = 1
// Explicitly point to the WASM binary in the same public/ folder
ort.env.wasm.wasmPaths = './'

const SAMPLE_RATE            = 16000
const FRAME_SAMPLES          = 512   // 32ms @ 16 kHz — Silero v5 requirement
const PAD_FRAMES             = 7     // ~224ms pre-speech padding to avoid clipping onsets
const SILENT_FRAMES_END_MIN  = 5     // ~160ms — for fast speakers (inter-word gap < 40ms)
const SILENT_FRAMES_END_MAX  = 8     // ~256ms — for slow/paused speakers
const SILENT_FRAMES_END_DEF  = 6     // ~192ms — default

let session         = null
let stateH          = null   // LSTM hidden state [2, 1, 64]
let stateC          = null   // LSTM cell  state  [2, 1, 64]
let frameBuffer     = new Float32Array(0)
let padBuffer       = []     // circular ring of recent frames (max PAD_FRAMES)
let isSpeechActive  = false
let silentFrames    = 0

// Dynamic threshold: track timestamps of recent speech_start events to gauge pace
const speechStartTimes = []   // ring buffer of last 4 speech_start timestamps
let dynamicSilentFramesEnd = SILENT_FRAMES_END_DEF

function updateDynamicThreshold() {
  if (speechStartTimes.length < 2) {
    dynamicSilentFramesEnd = SILENT_FRAMES_END_DEF
    return
  }
  const gaps = []
  for (let i = 1; i < speechStartTimes.length; i++) {
    gaps.push(speechStartTimes[i] - speechStartTimes[i - 1])
  }
  const avgGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length
  if (avgGapMs < 400) {
    dynamicSilentFramesEnd = SILENT_FRAMES_END_MIN   // fast speaker
  } else if (avgGapMs > 900) {
    dynamicSilentFramesEnd = SILENT_FRAMES_END_MAX   // slow speaker
  } else {
    dynamicSilentFramesEnd = SILENT_FRAMES_END_DEF
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function concatF32(a, b) {
  const out = new Float32Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function zeroState() {
  const data = new Float32Array(2 * 1 * 64)
  return new ort.Tensor('float32', data, [2, 1, 64])
}

// ── Model init ───────────────────────────────────────────────────────────────

async function init() {
  try {
    session = await ort.InferenceSession.create('./silero_vad.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
    stateH = zeroState()
    stateC = zeroState()
    postMessage({ type: 'ready' })
  } catch (err) {
    postMessage({ type: 'error', message: String(err) })
  }
}

// ── Frame inference ──────────────────────────────────────────────────────────

async function runFrame(samples) {
  const input = new ort.Tensor('float32', samples, [1, samples.length])
  const sr    = new ort.Tensor('int64', BigInt64Array.from([BigInt(SAMPLE_RATE)]), [1])

  const result = await session.run({ input, sr, h: stateH, c: stateC })

  stateH = result.hn
  stateC = result.cn
  return result.output.data[0]  // probability 0–1
}

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (ev) => {
  const msg = ev.data

  if (msg.type === 'init') {
    await init()
    return
  }

  if (msg.type === 'reset') {
    // Called between test sessions to reset LSTM state and silence counters
    stateH = zeroState()
    stateC = zeroState()
    frameBuffer    = new Float32Array(0)
    padBuffer      = []
    isSpeechActive = false
    silentFrames   = 0
    speechStartTimes.length = 0
    dynamicSilentFramesEnd = SILENT_FRAMES_END_DEF
    return
  }

  if (msg.type === 'pcm') {
    if (!session) return

    const incoming = new Float32Array(msg.buffer)
    frameBuffer = concatF32(frameBuffer, incoming)

    while (frameBuffer.length >= FRAME_SAMPLES) {
      const frame = frameBuffer.slice(0, FRAME_SAMPLES)
      frameBuffer  = frameBuffer.slice(FRAME_SAMPLES)

      // Maintain circular pad buffer
      padBuffer.push(frame)
      if (padBuffer.length > PAD_FRAMES) padBuffer.shift()

      let prob
      try {
        prob = await runFrame(frame)
      } catch {
        // If inference fails mid-session, forward audio unfiltered to avoid drop
        if (isSpeechActive) {
          const copy = frame.slice()
          postMessage({ type: 'audio', buffer: copy.buffer }, [copy.buffer])
        }
        continue
      }

      if (prob > 0.5) {
        if (!isSpeechActive) {
          isSpeechActive = true
          silentFrames   = 0
          const now = Date.now()
          speechStartTimes.push(now)
          if (speechStartTimes.length > 4) speechStartTimes.shift()
          updateDynamicThreshold()
          // Flush pre-speech pad buffer so the onset isn't clipped
          for (const padFrame of padBuffer) {
            const copy = padFrame.slice()
            postMessage({ type: 'audio', buffer: copy.buffer }, [copy.buffer])
          }
          postMessage({ type: 'speech_start', timestamp: Date.now() })
        } else {
          silentFrames = 0
          const copy = frame.slice()
          postMessage({ type: 'audio', buffer: copy.buffer }, [copy.buffer])
        }
      } else {
        if (isSpeechActive) {
          // Keep forwarding a few trailing frames to avoid clipping word endings
          const copy = frame.slice()
          postMessage({ type: 'audio', buffer: copy.buffer }, [copy.buffer])
          silentFrames++
          if (silentFrames >= dynamicSilentFramesEnd) {
            isSpeechActive = false
            postMessage({ type: 'speech_end', timestamp: Date.now() })
          }
        }
        // Non-speech and not in active segment — drop frame (do not send to Deepgram)
      }
    }
  }
}
