import { loadSprite } from '@/lib/spriteUtils'

export type MomentumSpriteTier = 'sleep' | '10+' | '70+' | '90+' | '120+'

/** Frame filenames per tier folder under /public/sprites */
export const MOMENTUM_SPRITE_FILES: Record<MomentumSpriteTier, readonly string[]> = {
  sleep: ['tile018.png', 'tile019.png'],
  '10+': ['tile000.png', 'tile001.png', 'tile002.png', 'tile003.png', 'tile004.png'],
  '70+': ['tile014.png', 'tile015.png', 'tile016.png', 'tile017.png'],
  '90+': ['tile009.png', 'tile010.png', 'tile011.png', 'tile012.png'],
  '120+': ['tile1.png', 'tile2.png'],
}

const SPRITE_BASE = '/sprites'

export function spritePath(tier: MomentumSpriteTier, file: string): string {
  return `${SPRITE_BASE}/${encodeURIComponent(tier)}/${file}`
}

/** Map live momentum score to the matching sprite folder. */
export function getMomentumSpriteTier(momentum: number, isActive: boolean): MomentumSpriteTier {
  if (!isActive || momentum <= 0) return 'sleep'
  if (momentum >= 120) return '120+'
  if (momentum >= 90) return '90+'
  if (momentum >= 70) return '70+'
  return '10+'
}

export async function loadMomentumSpriteTier(tier: MomentumSpriteTier): Promise<HTMLImageElement[]> {
  return Promise.all(MOMENTUM_SPRITE_FILES[tier].map((file) => loadSprite(spritePath(tier, file))))
}

export async function loadAllMomentumSprites(): Promise<Record<MomentumSpriteTier, HTMLImageElement[]>> {
  const tiers = Object.keys(MOMENTUM_SPRITE_FILES) as MomentumSpriteTier[]
  const loaded = await Promise.all(tiers.map((tier) => loadMomentumSpriteTier(tier)))
  return tiers.reduce(
    (acc, tier, i) => {
      acc[tier] = loaded[i]!
      return acc
    },
    {} as Record<MomentumSpriteTier, HTMLImageElement[]>
  )
}

export function drawFrameImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destW: number,
  destH: number
) {
  ctx.clearRect(0, 0, destW, destH)
  const scale = Math.min(destW / img.naturalWidth, destH / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  const dx = (destW - dw) / 2
  const dy = (destH - dh) / 2
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, dx, dy, dw, dh)
}
