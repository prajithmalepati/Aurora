/**
 * Extract dominant color from a cover image URL via canvas pixel sampling.
 *
 * Mirrors the backend's `extract_dominant_colors()` approach (MedianCut →
 * dominant hue) but runs client-side so playlist covers—which can be
 * uploaded/changed at any time—don't need a stored dominant_color column.
 *
 * Returns a CSS color string (oklch or rgb) suitable for glow/bleed effects,
 * or null if extraction fails.
 */

const SAMPLE_SIZE = 32 // downscale to 32×32 for fast sampling

/**
 * Extract the dominant color from an image URL.
 * Loads the image into an off-screen canvas, samples all pixels,
 * and returns the average color with boosted saturation for glow use.
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

    let rSum = 0
    let gSum = 0
    let bSum = 0
    const pixelCount = SAMPLE_SIZE * SAMPLE_SIZE

    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i]
      gSum += data[i + 1]
      bSum += data[i + 2]
    }

    let r = Math.round(rSum / pixelCount)
    let g = Math.round(gSum / pixelCount)
    let b = Math.round(bSum / pixelCount)

    // Boost saturation so the glow is visible on dark backgrounds.
    // Desaturate less (keep more chroma) and lighten slightly.
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const mid = (max + min) / 2

    // If the color is very dark or very grey, nudge toward a perceptible hue
    if (max - min < 30 || mid < 50) {
      // Lean toward teal (the aurora brand) but weighted by actual pixel average
      r = Math.max(r, 50)
      g = Math.max(g, 80)
      b = Math.max(b, 75)
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
