/**
 * Shared sprite helpers still used by momentum tiles / hero idle bounce.
 * Legacy sheet-crop APIs (main_mon / side_mon / speak_mon) were removed with those assets.
 */

/** Ping-pong column sequence for within-tier animation (e.g. [0,1,2,1,0]). */
export function buildPingPongCols(cols: number[]): number[] {
  if (cols.length <= 1) return [...cols]
  return [...cols, ...cols.slice(0, -1).reverse()]
}

export function loadSprite(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
