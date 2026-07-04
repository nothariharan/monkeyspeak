// browser web speech helpers — startup timeouts and error copy



export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {

  if (typeof window === 'undefined') return null

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null

}



type BraveNavigator = Navigator & { brave?: { isBrave?: () => Promise<boolean> } }



/** chrome usually fires onstart within a few seconds */

export const ONSTART_TIMEOUT_MS = {

  default: 3000,

  /** brave waits longer after mic permission */
  brave: 8000,

  /** edge cloud endpoint is slower to onstart */
  edge: 10000,

} as const



export type BrowserSpeechProfile = {

  isBrave: boolean

  isEdge: boolean

  /** use deepgram instead of webspeech on this browser */

  preferDeepgram: boolean

  onstartTimeoutMs: number

}



export function isEdgeBrowser(): boolean {

  if (typeof navigator === 'undefined') return false

  return /Edg\//i.test(navigator.userAgent)

}



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



export async function getBrowserSpeechProfile(): Promise<BrowserSpeechProfile> {

  const isBrave = await isBraveBrowser()

  const isEdge = isEdgeBrowser()

  const preferDeepgram = isBrave || isEdge || !getSpeechRecognitionCtor()

  const onstartTimeoutMs = isBrave

    ? ONSTART_TIMEOUT_MS.brave

    : isEdge

      ? ONSTART_TIMEOUT_MS.edge

      : ONSTART_TIMEOUT_MS.default



  return { isBrave, isEdge, preferDeepgram, onstartTimeoutMs }

}



/**

 * Brave Shields can block Google's speech endpoint; Edge uses a different cloud

 * service with slower onstart — both default to Deepgram in the app.

 */

export async function shouldPreferDeepgramStt(): Promise<boolean> {

  const profile = await getBrowserSpeechProfile()

  return profile.preferDeepgram

}



export function sleep(ms: number): Promise<void> {

  return new Promise((resolve) => window.setTimeout(resolve, ms))

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



/**

 * Prepare mic + optional prewarm before the live recognition session.

 *

 * Brave: skip getUserMedia preflight and prewarm — both interfere with

 * SpeechRecognition, which needs its own explicit allow prompt after mic access.

 *

 * Edge: request mic but skip prewarm — different speech endpoint, slower onstart.

 */

export async function prepareBrowserSpeech(lang: string): Promise<{

  profile: BrowserSpeechProfile

  permissionError?: string

}> {

  const profile = await getBrowserSpeechProfile()



  if (profile.isBrave) {

    return { profile }

  }



  const perm = await requestMicPermission()

  if (!perm.ok) {

    return { profile, permissionError: perm.error }

  }



  if (!profile.isEdge) {

    await prewarmWebSpeechRecognition(lang).catch(() => {})

  }



  return { profile }

}



export function buildSpeechErrorMessage(

  error: string,

  profile: Pick<BrowserSpeechProfile, 'isBrave' | 'isEdge'>

): string {

  switch (error) {

    case 'not-allowed':

      if (profile.isBrave) {

        return 'Allow microphone for this site, then accept Brave’s speech recognition prompt when it appears'

      }

      return 'Microphone permission denied — allow mic access for this site'

    case 'network':

      if (profile.isBrave) {

        return 'Brave Shields may be blocking Google’s speech service — lower Shields for this site or use Deepgram mode'

      }

      if (profile.isEdge) {

        return 'Edge could not reach its speech service — check your connection or use Deepgram mode'

      }

      return 'Speech recognition needs an internet connection'

    case 'audio-capture':

      return 'Could not capture microphone audio — check that another app is not using the mic'

    case 'service-not-allowed':

      return profile.isBrave

        ? 'Speech recognition is blocked — check site permissions and Brave Shields'

        : 'Speech recognition is disabled in this browser — check site permissions'

    default:

      return `Speech recognition error: ${error}`

  }

}



export function buildOnstartFailureMessage(

  profile: Pick<BrowserSpeechProfile, 'isBrave' | 'isEdge'>

): string {

  if (profile.isBrave) {

    return 'Speech recognition did not start — allow mic access, accept Brave’s speech prompt, and try lowering Shields for this site'

  }

  if (profile.isEdge) {

    return 'Speech recognition is still initializing on Edge — try again in a moment or switch to Deepgram mode'

  }

  return 'Speech recognition did not start — check mic permissions and try again'

}



/** Browsers where onstart can be slow enough to warrant one respawn retry. */

export function allowsSlowStartRetry(profile: Pick<BrowserSpeechProfile, 'isBrave' | 'isEdge'>): boolean {

  return profile.isBrave || profile.isEdge

}



/** Wait until recognition.onstart fires or timeoutMs elapses. */

export function waitForRecognitionStart(

  getStarted: () => boolean,

  timeoutMs: number = ONSTART_TIMEOUT_MS.default

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


