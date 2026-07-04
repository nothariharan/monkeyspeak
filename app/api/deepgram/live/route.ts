import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { checkAndReserveDeepgramSeconds } from '@/lib/deepgramRateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function resolveLanguage(params: URLSearchParams): string {
  return params.get('lang') ?? params.get('language') ?? 'en-US'
}

function resolveDuration(params: URLSearchParams): number {
  const valid = [15, 30, 60, 120]
  const n = parseInt(params.get('duration') ?? '', 10)
  return valid.includes(n) ? n : 120
}

function toSocketData(chunk: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(chunk.byteLength)
  copy.set(chunk)
  return copy.buffer
}

/**
 * Same-origin HTTP bridge: browser streams PCM in the request body and reads
 * NDJSON Deepgram events from the response. Avoids cross-origin WebSocket to
 * api.deepgram.com (blocked by Brave Shields and some Edge privacy settings).
 */
export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  const incoming = new URL(req.url)
  const duration = resolveDuration(incoming.searchParams)
  const ip = clientIp(req)
  const rateCheck = checkAndReserveDeepgramSeconds(ip, duration)
  if (!rateCheck.ok) {
    const msg =
      rateCheck.reason === 'ip_limit'
        ? `Daily Deepgram limit reached for your IP (${rateCheck.remainingSeconds}s remaining today). Switch to browser speech or try again tomorrow.`
        : `Global Deepgram quota exhausted for today. Switch to browser speech or try again tomorrow.`
    return Response.json({ error: msg, remainingSeconds: rateCheck.remainingSeconds }, { status: 429 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array>()
  const writer = stream.writable.getWriter()

  const writeLine = (line: string) => {
    void writer.write(encoder.encode(`${line}\n`)).catch(() => {})
  }

  writeLine(JSON.stringify({ type: 'BridgeReady' }))

  const deepgram = createClient(apiKey)
  const live = deepgram.listen.live({
    model: 'nova-3',
    language: resolveLanguage(incoming.searchParams),
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
    smart_format: false,
    interim_results: true,
    vad_events: true,
    endpointing: 10,
    no_delay: true,
    filler_words: true,
    utterance_end_ms: 1000,
  })

  let upstreamOpen = false
  const audioQueue: Uint8Array[] = []

  const flushQueue = () => {
    if (!upstreamOpen) return
    for (const chunk of audioQueue) live.send(toSocketData(chunk))
    audioQueue.length = 0
  }

  const waitForUpstream = () =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Deepgram upstream connection timed out'))
      }, 15_000)

      live.on(LiveTranscriptionEvents.Open, () => {
        clearTimeout(timeout)
        upstreamOpen = true
        flushQueue()
        resolve()
      })

      live.on(LiveTranscriptionEvents.Error, (err: unknown) => {
        clearTimeout(timeout)
        const message = err instanceof Error ? err.message : 'Deepgram upstream connection failed'
        reject(new Error(message))
      })
    })

  const forwardEvent = (payload: unknown) => {
    writeLine(JSON.stringify(payload))
  }

  live.on(LiveTranscriptionEvents.Transcript, forwardEvent)
  live.on(LiveTranscriptionEvents.SpeechStarted, forwardEvent)
  live.on(LiveTranscriptionEvents.UtteranceEnd, forwardEvent)
  live.on(LiveTranscriptionEvents.Metadata, forwardEvent)

  live.on(LiveTranscriptionEvents.Close, () => {
    void writer.close().catch(() => {})
  })

  const pipeAudio = async () => {
    try {
      const reader = req.body?.getReader()
      if (!reader) {
        writeLine(JSON.stringify({ type: 'Error', message: 'Missing request body stream' }))
        return
      }

      await waitForUpstream()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value.length <= 1) continue
        if (upstreamOpen) live.send(toSocketData(value))
        else audioQueue.push(value)
      }

      live.requestClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Audio stream failed'
      writeLine(JSON.stringify({ type: 'Error', message }))
    } finally {
      if (upstreamOpen) live.requestClose()
    }
  }

  void pipeAudio()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
