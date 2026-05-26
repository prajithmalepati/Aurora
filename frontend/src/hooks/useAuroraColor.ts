import { useEffect } from 'react'
import { converter, parse } from 'culori'
import { usePlayerStore } from '@/stores/playerStore'

const toLrgb = converter('lrgb')

export const BRAND_TEAL = 'oklch(0.72 0.18 195)'
export const DEFAULT_COLOR = 'oklch(0.55 0.12 210)'

// OKLCH at high chroma produces linear RGB values outside [0,1] (e.g. -0.12, 1.45).
// WebGL gl.uniform3fv clamps these unpredictably per browser, causing neon color shifts.
// Must clamp explicitly before passing to the shader.
const clampRgb = (v: number) => Math.max(0, Math.min(1, v))

export function oklchToLinearRgb(oklchStr: string): [number, number, number] {
  try {
    const parsed = parse(oklchStr)
    if (!parsed) return [0.40, 0.78, 0.72]
    const lrgb = toLrgb(parsed)
    return [clampRgb(lrgb?.r ?? 0), clampRgb(lrgb?.g ?? 0), clampRgb(lrgb?.b ?? 0)]
  } catch {
    return [0.40, 0.78, 0.72]
  }
}

export const BRAND_TEAL_LINEAR = oklchToLinearRgb(BRAND_TEAL)

/** Sets --song-color / --song-color-2 CSS vars on :root. No state, no re-render cascade. */
export function useAuroraColor(): void {
  const currentSong = usePlayerStore(s => s.currentSong)

  useEffect(() => {
    const color = currentSong?.dominant_color ?? DEFAULT_COLOR
    const color2 = currentSong?.dominant_color_2 ?? DEFAULT_COLOR
    document.documentElement.style.setProperty('--song-color', color)
    document.documentElement.style.setProperty('--song-color-2', color2)
  }, [currentSong?.id])
}
