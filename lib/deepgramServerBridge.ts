/** Server-side Deepgram listen URL builder (shared by /api/deepgram/live). */

export function buildDeepgramListenUrlFromParams(params: URLSearchParams): string {
  const p = new URLSearchParams(params)

  if (p.has('lang') && !p.has('language')) {
    p.set('language', p.get('lang')!)
    p.delete('lang')
  }

  const defaults: Record<string, string> = {
    model: 'nova-3',
    language: 'en-US',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    smart_format: 'false',
    interim_results: 'true',
    vad_events: 'true',
    endpointing: '10',
    no_delay: 'true',
    filler_words: 'true',
    utterance_end_ms: '1000',
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!p.has(key)) p.set(key, value)
  }

  return `wss://api.deepgram.com/v1/listen?${p.toString()}`
}
