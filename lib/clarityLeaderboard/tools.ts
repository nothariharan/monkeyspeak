/** Shared metadata for the speech-to-text tools tracked on the clarity benchmark. */

export type ClarityTool = {
  id: string
  name: string
  icon: string | null
  blurb: string
}

export const CLARITY_TOOLS: ClarityTool[] = [
  { id: 'wispr', name: 'Wispr Flow', icon: 'https://cdn.prod.website-files.com/682f84b3838c89f8ff7667db/68d427c7c5f98194a1c53c61_logo-symbol-dark.png', blurb: 'desktop dictation' },
  { id: 'chatgpt', name: 'ChatGPT Voice', icon: null, blurb: 'voice transcription' },
  { id: 'apple', name: 'Apple Dictation', icon: 'https://cdn.simpleicons.org/apple/111111', blurb: 'system dictation' },
  { id: 'deepgram', name: 'Deepgram', icon: 'https://cdn.simpleicons.org/deepgram/13EF93', blurb: 'Nova speech API' },
  { id: 'browser', name: 'Chrome Speech', icon: 'https://cdn.simpleicons.org/googlechrome/4285F4', blurb: 'Web Speech API' },
]

export function clarityToolIcon(toolId: string): string | null {
  return CLARITY_TOOLS.find((tool) => tool.id === toolId)?.icon ?? null
}
