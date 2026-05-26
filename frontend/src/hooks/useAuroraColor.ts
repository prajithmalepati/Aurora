import { useEffect, useRef } from 'react'
import { converter, parse } from 'culori'
import { usePlayerStore } from '@/stores/playerStore'

const toLrgb = converter('lrgb')

const BRAND_TEAL = 'oklch(0.72 0.18 195)'
const DEFAULT_COLOR = 'oklch(0.55 0.12 210)'

// OKLCH at high chroma produces linear RGB values outside [0,1] (e.g. -0.12, 1.45).
// WebGL gl.uniform3fv clamps these unpredictably per browser, causing neon color shifts.
// Must clamp explicitly before passing to the shader.
const clampRgb = (v: number) => Math.max(0, Math.min(1, v))

function oklchToLinearRgb(oklchStr: string): [number, number, number] {
  try {
    const parsed = parse(oklchStr)
    if (!parsed) return [0.40, 0.78, 0.72]
    const lrgb = toLrgb(parsed)
    return [clampRgb(lrgb?.r ?? 0), clampRgb(lrgb?.g ?? 0), clampRgb(lrgb?.b ?? 0)]
  } catch {
    return [0.40, 0.78, 0.72]
  }
}

export interface AuroraColorState {
  /** Linear RGB for shader uColor2 uniform */
  color2LinearRgb: [number, number, number]
  /** Linear RGB for shader uColor1 (fixed brand teal, never changes) */
  color1LinearRgb: [number, number, number]
}

const BRAND_TEAL_LINEAR = oklchToLinearRgb(BRAND_TEAL)

export function useAuroraColor(): AuroraColorState {
  const currentSong = usePlayerStore(s => s.currentSong)

  const color2Linear = useRef<[number, number, number]>(oklchToLinearRgb(DEFAULT_COLOR))

  useEffect(() => {
    const color = currentSong?.dominant_color ?? DEFAULT_COLOR
    const color2 = currentSong?.dominant_color_2 ?? DEFAULT_COLOR

    // Set CSS variables on :root for halo, bleed, waveform fill
    document.documentElement.style.setProperty('--song-color', color)
    document.documentElement.style.setProperty('--song-color-2', color2)

    // Compute linear RGB for shader
    color2Linear.current = oklchToLinearRgb(color2)
  }, [currentSong?.id])

  return {
    color2LinearRgb: color2Linear.current,
    color1LinearRgb: BRAND_TEAL_LINEAR,
  }
}
