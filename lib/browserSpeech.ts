/** Shared helpers for browser Web Speech API startup and error copy. */

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

type BraveNavigator = Navigator & { brave?: { isBrave?: () => Promise<boolean> } }

/** Detect Brave (Chromium) for Shields-specific error hints. */
export async function isBraveBrowser(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const brave = (navigator as BraveNavigator).brave
  if (brave?.isBrave) {
    try {
      return await brave.isBrave()
    } catch {
      /* fall through */
    }
  }
  return /Brave/i.test(navigator.userAgent)
}

/**
 * Request mic permission without keeping a live capture stream.
 * SpeechRecognition owns the mic; a parallel stream breaks recognition on Windows.
 */
export async function requestMicPermission(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: 'Microphone access is not available in this browser' }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    })
    stream.getTracks().forEach((t) => t.stop())
    return { ok: true }
  } catch (err: unknown) {
    const isDenied =
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
    return {
      ok: false,
      error: isDenied
        ? 'Microphone permission denied — allow mic access for this site'
        : 'Could not access microphone',
    }
  }
}

/**
 * Short-lived recognition start/stop to warm the browser + cloud pipeline (best-effort).
 * Uses a separate instance from the live session.
 */
export function prewarmWebSpeechRecognition(lang: string): Promise<void> {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return Promise.resolve()

  return new Promise((resolve) => {
    const r = new Ctor()
    r.continuous = false
    r.interimResults = false
    r.lang = lang
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      try {
        r.onstart = null
        r.onend = null
        r.onerror = null
        r.abort()
      } catch {
        /* ignore */
      }
      resolve()
    }
    r.onstart = () => { window.setTimeout(done, 120) }
    r.onend = () => done()
    r.onerror = () => done()
    window.setTimeout(done, 2500)
    try { r.start() } catch { done() }
  })
}

export function buildSpeechErrorMessage(error: string, isBrave: boolean): string {
  switch (error) {
    case 'not-allowed':
      return 'Microphone permission denied — allow mic access for this site'
    case 'network':
      return isBrave
        ? 'Speech recognition blocked — try lowering Brave Shields for this site or check your connection'
        : 'Speech recognition needs an internet connection'
    case 'audio-capture':
      return 'Could not capture microphone audio — check that another app is not using the mic'
    case 'service-not-allowed':
      return 'Speech recognition is disabled in this browser — check site permissions'
    default:
      return `Speech recognition error: ${error}`
  }
}

/** Wait until recognition.onstart fires or timeoutMs elapses. */
export function waitForRecognitionStart(
  getStarted: () => boolean,
  timeoutMs = 3000
): Promise<boolean> {
  if (getStarted()) return Promise.resolve(true)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const tick = () => {
      if (getStarted()) {
        resolve(true)
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false)
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}
