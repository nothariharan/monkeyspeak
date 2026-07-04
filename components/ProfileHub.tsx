/* eslint-disable @next/next/no-img-element */
'use client'


import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useTestStore } from '@/store/testStore'
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements'

interface ProfileHubProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Inline Hand-Drawn SVG Assets ─────────────────────────────────────────────

function DoodleMicIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill={unlocked ? `${color}20` : 'none'} />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8" />
      {/* Hand-drawn scribble ring */}
      <circle cx="12" cy="11" r="9" stroke={unlocked ? color : 'var(--border)'} strokeDasharray="3 3" opacity="0.5" />
    </svg>
  )
}

function DoodleSpeedIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L12 12" />
      <path d="M21 12a9 9 0 0 1-9 9" />
      <path d="m12 12 4 2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M18.5 5.5c1.5 1.5 2.5 3.5 2.5 5.5" strokeDasharray="2 2" />
      {/* Doodle speed lines */}
      <path d="M2 8h2M3 5l1.5 1M6 2v2" opacity="0.7" />
    </svg>
  )
}

function DoodleFireIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5Z" fill={unlocked ? `${color}20` : 'none'} />
      {/* Extra scribble sparks */}
      <path d="M4 6h1M19 4h1M21 9h1" opacity="0.6" />
    </svg>
  )
}

function DoodleZenIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill={unlocked ? `${color}20` : 'none'} />
      <path d="M5 20c0-3.5 3-5 7-5s7 1.5 7 5H5Z" />
      <path d="M8 12c-2-1-4-1-6 0M16 12c2-1 4-1 6 0" />
      {/* Hand-drawn balance circles */}
      <circle cx="12" cy="11" r="1.5" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

function DoodleClockIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" fill={unlocked ? `${color}20` : 'none'} />
      <polyline points="12 8 12 12 15 14" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2" opacity="0.6" />
      <path d="m5 5 1.5 1.5M17.5 17.5l1.5 1.5" strokeDasharray="1 1" />
    </svg>
  )
}

function DoodleStarIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={unlocked ? `${color}20` : 'none'} />
      {/* Sparkle lines */}
      <path d="M12 1v1M23 9h-1M1 9h1M18 19l1 1M5 19l-1 1" opacity="0.7" />
    </svg>
  )
}

function DoodleTongueIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={unlocked ? `${color}20` : 'none'} />
      <path d="M8 9h.01M16 9h.01" strokeWidth="2.5" />
      <path d="M9 14.5c.5 1.5 1.5 2.5 3 2.5s2.5-1 3-2.5" />
      {/* Tongue sticking out */}
      <path d="M11 16.8v3.5a1.5 1.5 0 0 0 3 0v-3.5" fill={unlocked ? `${color}40` : 'none'} />
      <line x1="12.5" y1="17" x2="12.5" y2="19.5" />
    </svg>
  )
}

function DoodleChatIcon({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={unlocked ? color : 'var(--text-stats)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={unlocked ? `${color}20` : 'none'} />
      <path d="M8 8h8M8 12h5" opacity="0.7" />
      <circle cx="19" cy="5" r="3" stroke={unlocked ? color : 'var(--border)'} strokeDasharray="2 2" />
    </svg>
  )
}

// ─── Mascot Visual Avatars ────────────────────────────────────────────────────



export default function ProfileHub({ isOpen, onClose }: ProfileHubProps) {
  const { settings } = useTestStore()
  const panelRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const history = settings.sessionHistory ?? []
  const activeColor = settings.accentHex || '#3b82f6'

  // Animate slide in
  useEffect(() => {
    if (!isOpen || !panelRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(backdropRef.current, { opacity: 0, duration: 0.25 })
      gsap.from(panelRef.current, { x: '100%', duration: 0.35, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [isOpen])

  // Escape key close
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // 1. Calculate best WPM
  const maxWpm = Object.values(settings.personalBests ?? {}).reduce(
    (max, pb) => Math.max(max, pb.wpm),
    0
  )

  // 2. Select Mascot based on WPM
  let mascotAvatar = (
    <img
      src="/mascot_sleepy.png"
      alt="Sleepy Monkey Mascot"
      width="80"
      height="80"
      className="object-contain"
    />
  )
  let tierLabel = 'Sleepy Monkey'
  let nextMilestone = 'Reach 70+ WPM to unlock standard mode'

  if (maxWpm >= 150) {
    mascotAvatar = (
      <img
        src="/mascot_fire.png"
        alt="Super Fire Monkey Mascot"
        width="80"
        height="80"
        className="object-contain animate-pulse"
      />
    )
    tierLabel = 'Super Fire Monkey'
    nextMilestone = 'Absolute legend! Max Speaking Momentum.'
  } else if (maxWpm >= 110) {
    mascotAvatar = (
      <img
        src="/mascot_athletic.png"
        alt="Athletic Monkey Mascot"
        width="80"
        height="80"
        className="object-contain"
      />
    )
    tierLabel = 'Athletic Monkey'
    nextMilestone = 'Next: Hit 150+ WPM to unlock Fire Aura'
  } else if (maxWpm >= 70) {
    mascotAvatar = (
      <img
        src="/mascot_standard.png"
        alt="Active Monkey Mascot"
        width="80"
        height="80"
        className="object-contain"
      />
    )
    tierLabel = 'Active Monkey'
    nextMilestone = 'Next: Hit 110+ WPM to unlock Athletic mode'
  }

  // 3. Build Heatmap for the last 6 months (24 weeks * 7 days = 168 cells)
  const buildHeatmapCells = () => {
    const cells: { dateStr: string; count: number; dayOfWeek: number }[] = []
    const today = new Date()
    // Align starting day to Sunday 24 weeks ago
    const totalDays = 24 * 7
    const startDate = new Date()
    startDate.setDate(today.getDate() - totalDays + 1)

    // Roll back to the nearest Sunday
    const startDay = startDate.getDay()
    startDate.setDate(startDate.getDate() - startDay)

    const dateIter = new Date(startDate)
    // Run exactly 24 weeks * 7 days = 168 cells
    for (let i = 0; i < 168; i++) {
      const dateStr = dateIter.toISOString().split('T')[0]
      const count = settings.speakingActivity?.[dateStr] ?? 0
      cells.push({
        dateStr,
        count,
        dayOfWeek: dateIter.getDay(),
      })
      dateIter.setDate(dateIter.getDate() + 1)
    }
    return cells
  }

  const heatmapCells = buildHeatmapCells()

  // Calculate current streak
  const calculateStreak = () => {
    let streak = 0
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Start checking from today or yesterday
    let checkDate = new Date()
    let checkStr = checkDate.toISOString().split('T')[0]
    
    if (!(settings.speakingActivity?.[checkStr] > 0)) {
      // check yesterday
      checkDate = yesterday
      checkStr = yesterdayStr
    }

    while (settings.speakingActivity?.[checkStr] > 0) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
      checkStr = checkDate.toISOString().split('T')[0]
    }

    return streak
  }

  const currentStreak = calculateStreak()

  // Helper to render achievement badge
  const renderBadge = (ach: Achievement) => {
    const unlocked = settings.unlockedAchievements?.includes(ach.id) ?? false
    let icon = <DoodleMicIcon unlocked={unlocked} color={activeColor} />

    switch (ach.iconType) {
      case 'speed':
        icon = <DoodleSpeedIcon unlocked={unlocked} color={activeColor} />
        break
      case 'fire':
        icon = <DoodleFireIcon unlocked={unlocked} color={activeColor} />
        break
      case 'zen':
        icon = <DoodleZenIcon unlocked={unlocked} color={activeColor} />
        break
      case 'clock':
        icon = <DoodleClockIcon unlocked={unlocked} color={activeColor} />
        break
      case 'star':
        icon = <DoodleStarIcon unlocked={unlocked} color={activeColor} />
        break
      case 'tongue':
        icon = <DoodleTongueIcon unlocked={unlocked} color={activeColor} />
        break
      case 'chat':
        icon = <DoodleChatIcon unlocked={unlocked} color={activeColor} />
        break
    }

    return (
      <div
        key={ach.id}
        className={`achievement-card ${
          unlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'
        }`}
      >
        <div className="p-1 rounded-full">{icon}</div>
        <p className="font-mono text-xs font-bold leading-tight" style={{ color: unlocked ? 'var(--text-active)' : 'var(--text-stats)' }}>
          {ach.title}
        </p>
        <p className="font-mono text-[9px] leading-tight" style={{ color: 'var(--text-stats)' }}>
          {ach.description}
        </p>
        {unlocked && (
          <span
            className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full flex items-center justify-center"
            style={{ background: activeColor }}
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>
    )
  }

  // Lifetime Stats safe accessors
  const lifetime = settings.lifetimeStats ?? {
    totalRuns: 0,
    totalSeconds: 0,
    totalWords: 0,
    totalFillers: 0,
    avgAccuracy: 0,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Drawer */}
      <aside
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-[500px] z-50 overflow-y-auto flex flex-col profile-drawer"
        role="dialog"
        aria-label="Speaker Profile"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 45%, transparent)' }}
        >
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold tracking-wide" style={{ color: 'var(--text-active)' }}>
              monkey profile
            </span>
            <span className="badge font-mono text-[10px] px-2 py-0.5 rounded-full border border-solid" style={{ borderColor: 'var(--border)', color: activeColor }}>
              unlocked
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="p-1 transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-stats)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-6">
          
          {/* Mascot Section */}
          <section className="stats-card flex items-center gap-5">
            <div className="p-2 note-panel rounded-lg">
              {mascotAvatar}
            </div>
            <div className="flex-1 flex flex-col">
              <p className="font-display font-black text-base" style={{ color: 'var(--text-active)' }}>
                {tierLabel}
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-stats)' }}>
                Personal Best: <span style={{ color: activeColor, fontWeight: 700 }}>{maxWpm > 0 ? `${maxWpm} WPM` : '—'}</span>
              </p>
              <p className="font-mono text-[10px] mt-2 italic" style={{ color: 'var(--text-stats)' }}>
                {nextMilestone}
              </p>
            </div>
          </section>

          <hr className="profile-section-divider" />

          {/* Stats Grid */}
          <section className="flex flex-col gap-3">
            <p className="stat-label">lifetime stats</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'total runs', value: lifetime.totalRuns },
                { label: 'time speaking', value: `${Math.floor(lifetime.totalSeconds / 60)}m ${lifetime.totalSeconds % 60}s` },
                { label: 'words spoken', value: lifetime.totalWords },
                { label: 'fillers avoided', value: lifetime.totalFillers },
                { label: 'average accuracy', value: `${lifetime.avgAccuracy}%` },
                { label: 'active streak', value: `${currentStreak} day${currentStreak !== 1 ? 's' : ''}` },
              ].map(({ label, value }) => (
                <div key={label} className="stats-metric">
                  <p className="stat-label">{label}</p>
                  <p className="stat-value text-sm">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="profile-section-divider" />

          {/* Activity Heatmap */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="stat-label">speaking activity</p>
              <span className="font-mono text-[10px]" style={{ color: activeColor }}>
                {currentStreak > 0 ? `${currentStreak} day streak 🔥` : 'no active streak'}
              </span>
            </div>
            
            {/* Heatmap Grid Wrapper */}
            <div className="stats-card overflow-x-auto">
              {/* 24 Weeks x 7 Days Grid */}
              <div
                className="grid grid-flow-col gap-1.5"
                style={{
                  gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                  gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
                  width: 'fit-content',
                }}
              >
                {heatmapCells.map((cell, idx) => {
                  let opacity = 0.08
                  if (cell.count > 0) {
                    opacity = Math.min(0.2 + (cell.count * 0.25), 1.0)
                  }

                  return (
                    <div
                      key={idx}
                      title={`${cell.dateStr}: ${cell.count} session${cell.count !== 1 ? 's' : ''}`}
                      className="w-2.5 h-2.5 rounded-sm transition-all hover:scale-125"
                      style={{
                        background: cell.count > 0 ? activeColor : 'var(--text-stats)',
                        opacity,
                      }}
                    />
                  )
                })}
              </div>

              {/* Legend info */}
              <div className="flex items-center justify-between font-mono text-[9px] mt-3" style={{ color: 'var(--text-stats)' }}>
                <span>6 months ago</span>
                <div className="flex items-center gap-1">
                  <span>less</span>
                  <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--text-stats)', opacity: 0.08 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ background: activeColor, opacity: 0.35 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ background: activeColor, opacity: 0.7 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ background: activeColor, opacity: 1.0 }} />
                  <span>more</span>
                </div>
                <span>today</span>
              </div>
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '3px solid var(--border)' }} />

          {/* Sticker Book / Badges */}
          <section className="flex flex-col gap-3">
            <p className="stat-label">sticker achievements</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((ach) => renderBadge(ach))}
            </div>
          </section>

        </div>
      </aside>
    </>
  )
}
