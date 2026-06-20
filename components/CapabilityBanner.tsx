'use client'

import { useEffect, useState } from 'react'
import { getBrowserSpeechProfile, type BrowserSpeechProfile } from '@/lib/browserSpeech'
import { useTestStore } from '@/store/testStore'

const DISMISSED_KEY = 'ms_cap_banner_dismissed'

function getBannerMessage(profile: BrowserSpeechProfile): string {
  if (profile.isBrave) {
    return 'Brave Shields may block browser speech — using Deepgram for accuracy. Lower Shields for this site if you want browser mode.'
  }
  if (profile.isEdge) {
    return 'Edge speech initializes slowly — Deepgram enabled with extended timeout.'
  }
  return "This browser doesn't support Web Speech — Deepgram mode active."
}

export default function CapabilityBanner() {
  const [profile, setProfile] = useState<BrowserSpeechProfile | null>(null)
  const [show, setShow] = useState(false)
  const store = useTestStore()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DISMISSED_KEY)) return

    getBrowserSpeechProfile().then((p) => {
      if (!p.preferDeepgram) return
      setProfile(p)
      setShow(true)
      if (store.settings.sttProvider !== 'deepgram') {
        store.setSttProvider('deepgram')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (!show || !profile) return null

  return (
    <div
      role="alert"
      className="note-panel font-mono px-4 py-3 flex items-center justify-between gap-4 w-full"
      style={{ borderColor: 'var(--accent)', color: 'var(--text-muted)', fontSize: '0.78rem' }}
    >
      <span>{getBannerMessage(profile)}</span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss compatibility notice"
        className="plain-icon-btn"
        style={{ flexShrink: 0, fontSize: '1rem', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}
