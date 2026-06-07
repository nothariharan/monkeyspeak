export interface SpriteFrame {
  sx: number
  sy: number
  w: number
  h: number
}

export const MAIN_MON_FRAMES = 5
export const SIDE_MON_FRAMES = 4

/** Per-frame crop bounds in side_mon.png (uneven spacing). */
export const SIDE_MON_TRIM_RECTS: SpriteFrame[] = [
  { sx: 36, sy: 224, w: 374, h: 444 },
  { sx: 491, sy: 235, w: 376, h: 433 },
  { sx: 929, sy: 244, w: 368, h: 428 },
  { sx: 1354, sy: 243, w: 351, h: 420 },
]

export const SPEAK_ROW_CONFIG = {
  calm: { row: 0, cols: 5 },
  cool: { row: 1, cols: 6 },
  sleepy: { row: 2, cols: 6 },
} as const

export type SpeakRow = keyof typeof SPEAK_ROW_CONFIG

export type WpmTier = 'sleeping' | 'smiling' | 'beatboxing' | 'mic' | 'shades'

const WPM_TIER_POSE: Record<WpmTier, { row: SpeakRow; col: number }> = {
  sleeping: { row: 'sleepy', col: 0 },
  smiling: { row: 'calm', col: 0 },
  beatboxing: { row: 'sleepy', col: 2 },
  mic: { row: 'cool', col: 3 },
  shades: { row: 'cool', col: 0 },
}

export function getWpmTier(wpm: number): WpmTier {
  if (wpm >= 150) return 'shades'
  if (wpm >= 100) return 'mic'
  if (wpm >= 50) return 'beatboxing'
  if (wpm >= 25) return 'smiling'
  return 'sleeping'
}

/** Map 0–100 speaking momentum to monkey pose tier. */
export function getMomentumTier(momentum: number): WpmTier {
  if (momentum >= 85) return 'shades'
  if (momentum >= 60) return 'mic'
  if (momentum >= 35) return 'beatboxing'
  if (momentum >= 15) return 'smiling'
  return 'sleeping'
}

export function getSpeakMonPose(tier: WpmTier): { row: SpeakRow; col: number } {
  return WPM_TIER_POSE[tier]
}

export function getMainMonFrameRect(img: HTMLImageElement, index: number): SpriteFrame {
  const frameCount = MAIN_MON_FRAMES
  const clamped = Math.max(0, Math.min(frameCount - 1, index))
  const unitW = img.naturalWidth / frameCount
  const sx = Math.round(clamped * unitW)
  const ex = Math.round((clamped + 1) * unitW)
  return { sx, sy: 0, w: ex - sx, h: img.naturalHeight }
}

export function getSideMonFrameRect(_img: HTMLImageElement, index: number): SpriteFrame {
  const clamped = Math.max(0, Math.min(SIDE_MON_FRAMES - 1, index))
  return SIDE_MON_TRIM_RECTS[clamped]!
}

export function getSpeakMonFrameRect(
  img: HTMLImageElement,
  row: SpeakRow,
  col: number
): SpriteFrame {
  const { row: rowIndex, cols } = SPEAK_ROW_CONFIG[row]
  const clamped = Math.max(0, Math.min(cols - 1, col))
  const colUnit = img.naturalWidth / 6
  const rowUnit = img.naturalHeight / 3
  const sx = Math.round(clamped * colUnit)
  const ex = Math.round((clamped + 1) * colUnit)
  const sy = Math.round(rowIndex * rowUnit)
  const ey = Math.round((rowIndex + 1) * rowUnit)
  return { sx, sy, w: ex - sx, h: ey - sy }
}

export function getSpeakMonFrameForTier(img: HTMLImageElement, tier: WpmTier): SpriteFrame {
  const { row, col } = getSpeakMonPose(tier)
  return getSpeakMonFrameRect(img, row, col)
}

export type SpriteAnchor = 'center' | 'bottom-left'

export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frame: SpriteFrame,
  destW: number,
  destH: number,
  anchor: SpriteAnchor = 'center'
) {
  ctx.clearRect(0, 0, destW, destH)

  const scale = Math.min(destW / frame.w, destH / frame.h)
  const dw = frame.w * scale
  const dh = frame.h * scale
  const dx = anchor === 'bottom-left' ? 0 : (destW - dw) / 2
  const dy = anchor === 'bottom-left' ? destH - dh : (destH - dh) / 2

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    img,
    frame.sx,
    frame.sy,
    frame.w,
    frame.h,
    dx,
    dy,
    dw,
    dh
  )
}

export function loadSprite(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
