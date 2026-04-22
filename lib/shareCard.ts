/**
 * Share card generator — renders a PNG card using HTML5 Canvas
 * and triggers a browser download.
 * PRD §12
 */

interface SpeedShareStats {
  mode: 'speed'
  wpm: number
  consistency: number
  fillerCount: number
  duration: number
  promptType: string
}

interface ClarityShareStats {
  mode: 'clarity'
  clarityScore: number
  clarityGrade: string
}

type ShareStats = SpeedShareStats | ClarityShareStats

export function generateShareCard(stats: ShareStats): void {
  if (typeof window === 'undefined') return

  const W = 600
  const H = 300
  const canvas = document.createElement('canvas')
  canvas.width  = W * 2   // retina
  canvas.height = H * 2
  canvas.style.width  = `${W}px`
  canvas.style.height = `${H}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(2, 2)

  const BG      = '#0d0d0d'
  const ACCENT  = '#e8c96a'
  const MUTED   = '#888888'
  const ACTIVE  = '#e2e2e2'
  const DIVIDER = '#3a3a3a'

  // Background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Border
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 1
  ctx.strokeRect(1, 1, W - 2, H - 2)

  // Logo
  ctx.font = '600 16px "JetBrains Mono", monospace'
  ctx.fillStyle = ACTIVE
  ctx.fillText('monkey', 32, 44)
  const logoX = 32 + ctx.measureText('monkey').width
  ctx.fillStyle = ACCENT
  ctx.fillText('speak', logoX, 44)

  // Divider line 1
  ctx.beginPath()
  ctx.strokeStyle = DIVIDER
  ctx.moveTo(32, 60)
  ctx.lineTo(W - 32, 60)
  ctx.stroke()

  if (stats.mode === 'speed') {
    // Big WPM
    ctx.font = 'bold 72px "JetBrains Mono", monospace'
    ctx.fillStyle = ACCENT
    ctx.fillText(String(stats.wpm), 32, 145)
    const wpmW = ctx.measureText(String(stats.wpm)).width

    ctx.font = '20px "JetBrains Mono", monospace'
    ctx.fillStyle = MUTED
    ctx.fillText(' wpm', 32 + wpmW, 145)

    // Secondary stats
    ctx.font = '13px "JetBrains Mono", monospace'
    ctx.fillStyle = ACTIVE
    ctx.fillText(`${stats.consistency}% consistency  ·  ${stats.fillerCount} fillers removed`, 32, 178)
    ctx.fillStyle = MUTED
    ctx.fillText(`${stats.duration} seconds  ·  ${stats.promptType} mode`, 32, 200)
  } else {
    // Clarity score
    ctx.font = 'bold 64px "JetBrains Mono", monospace'
    ctx.fillStyle = ACCENT
    ctx.fillText(`${stats.clarityScore}%`, 32, 145)
    const scoreW = ctx.measureText(`${stats.clarityScore}%`).width

    ctx.font = 'bold 40px "JetBrains Mono", monospace'
    ctx.fillStyle = '#6ae8a8'
    ctx.fillText(`  ${stats.clarityGrade}`, 32 + scoreW, 145)

    ctx.font = '13px "JetBrains Mono", monospace'
    ctx.fillStyle = MUTED
    ctx.fillText('clarity score', 32, 178)
  }

  // Divider line 2
  ctx.beginPath()
  ctx.strokeStyle = DIVIDER
  ctx.moveTo(32, 230)
  ctx.lineTo(W - 32, 230)
  ctx.stroke()

  // Footer
  ctx.font = '11px "JetBrains Mono", monospace'
  ctx.fillStyle = MUTED
  ctx.fillText('monkeyspeak.app', 32, 258)

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monkeyspeak-${stats.mode}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
