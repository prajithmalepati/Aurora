/**
 * Extract dominant color from a cover image URL via canvas pixel sampling.
 *
 * Uses a coarse hue-histogram approach: groups pixels into 12 hue buckets
 * (30° each) and picks the most-populated saturated bucket. Falls back to
 * the brightest bucket if nothing is saturated enough. This avoids the
 * "muddy grey" problem of simple RGB averaging.
 *
 * Returns a CSS color string (rgb) suitable for glow/bleed effects,
 * or null if extraction fails.
 */

const SAMPLE_SIZE = 32 // downscale to 32×32 for fast sampling

/** Hue bucket index (0–11) for an RGB color. Returns -1 if grey. */
function hueBucket(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  // Grey if saturation < ~12%
  if (delta < 30 || max < 30) return -1

  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4

  if (hue < 0) hue += 6
  return Math.floor(hue / 0.5) // 0–11 (each bucket = 30°)
}

/**
 * Extract the dominant color from an image URL.
 * Loads the image into an off-screen canvas, builds a hue histogram,
 * and returns the dominant saturated color with boosted brightness.
 */
export async function extractCoverColor(imageUrl: string): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"

    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Image load failed"))
      img.src = imageUrl
    })

    await loaded

    const canvas = document.createElement("canvas")
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

    // Build hue histogram: 12 buckets, each accumulates (r, g, b, count)
    const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, count: 0 }))
    // Fallback: track brightest-grey bucket for monochrome covers
    let greyBucket = { r: 0, g: 0, b: 0, count: 0, brightness: 0 }

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const bucket = hueBucket(r, g, b)

      if (bucket >= 0) {
        buckets[bucket].r += r
        buckets[bucket].g += g
        buckets[bucket].b += b
        buckets[bucket].count++
      } else {
        // Grey pixel — track for fallback
        greyBucket.r += r
        greyBucket.g += g
        greyBucket.b += b
        greyBucket.count++
        const brightness = (r + g + b) / 3
        if (brightness > greyBucket.brightness) greyBucket.brightness = brightness
      }
    }

    // Pick the most-populated saturated bucket
    let best = buckets[0]
    for (const b of buckets) {
      if (b.count > best.count) best = b
    }

    let r: number, g: number, b: number

    if (best.count > 0) {
      // Saturated bucket won — use its average
      r = Math.round(best.r / best.count)
      g = Math.round(best.g / best.count)
      b = Math.round(best.b / best.count)
    } else if (greyBucket.count > 0) {
      // All grey — use the average (will be desaturated)
      r = Math.round(greyBucket.r / greyBucket.count)
      g = Math.round(greyBucket.g / greyBucket.count)
      b = Math.round(greyBucket.b / greyBucket.count)
    } else {
      return null
    }

    // Lighten: pull toward white by 20% so the glow reads on OLED black
    const lift = 0.2
    r = Math.round(r + (255 - r) * lift)
    g = Math.round(g + (255 - g) * lift)
    b = Math.round(b + (255 - b) * lift)

    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return null
  }
}
