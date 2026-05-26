import { useId, useRef, useEffect, useCallback } from 'react'

interface WaveformBarProps {
  peaks: number[]   // 1000 floats [0–1]
  duration: number  // song duration in seconds
  seek: number      // current playhead position in seconds, from playerStore
}

const BAR_COUNT = 200
// Fixed SVG coordinate space — eliminates clientWidth read during render.
const VIEW_W = 600
const VIEW_H = 32

function resamplePeaks(peaks: number[], target: number): number[] {
  if (!peaks.length) return new Array(target).fill(0)
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    const lo = Math.floor((i / target) * peaks.length)
    const hi = Math.min(peaks.length - 1, Math.ceil(((i + 1) / target) * peaks.length) - 1)
    let max = 0
    for (let j = lo; j <= hi; j++) max = Math.max(max, peaks[j])
    out.push(max)
  }
  return out
}

function buildPath(resampled: number[]): string {
  if (!resampled.length) return ''
  const barW = VIEW_W / resampled.length
  const midY = VIEW_H / 2
  let d = ''
  for (let i = 0; i < resampled.length; i++) {
    const x = i * barW + barW * 0.5
    const h = Math.max(2, resampled[i] * VIEW_H * 0.85)
    d += `M${x.toFixed(1)},${(midY - h / 2).toFixed(1)}L${x.toFixed(1)},${(midY + h / 2).toFixed(1)}`
  }
  return d
}

// PURELY VISUAL — aria-hidden, pointer-events-none.
// Seek interaction handled by native <input type="range"> overlaid in PlayerBar (Task 5.3).
export function WaveformBar({ peaks, duration, seek }: WaveformBarProps) {
  const clipId      = useId()
  const clipRectRef = useRef<SVGRectElement>(null)
  const playlineRef = useRef<SVGLineElement>(null)
  const rafRef      = useRef<number | null>(null)
  const seekRef     = useRef(seek)

  const resampled = resamplePeaks(peaks, BAR_COUNT)
  const path      = buildPath(resampled)
  const barW      = VIEW_W / BAR_COUNT

  // Keep seekRef current so RAF reads the latest store value without re-running.
  // Under reduced-motion this still updates the ref so progress is rendered
  // on the next effect run — static progress, no animation.
  useEffect(() => {
    seekRef.current = seek
    // Under reduced-motion: RAF is stopped, so write directly to DOM.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && duration) {
      const progress = seek / duration
      const x = progress * VIEW_W
      clipRectRef.current?.setAttribute('width', String(x))
      playlineRef.current?.setAttribute('x1', String(x))
      playlineRef.current?.setAttribute('x2', String(x))
    }
  }, [seek, duration])

  // RAF tick — reads seekRef (from store, not Howler internals).
  // Runs at 60fps for smooth interpolation between the 250ms store ticks.
  const tick = useCallback(() => {
    if (duration) {
      const progress = seekRef.current / duration
      const x        = progress * VIEW_W
      clipRectRef.current?.setAttribute('width', String(x))
      playlineRef.current?.setAttribute('x1', String(x))
      playlineRef.current?.setAttribute('x2', String(x))
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [duration])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mql.matches) return

    rafRef.current = requestAnimationFrame(tick)

    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    mql.addEventListener('change', onMotionChange)

    return () => {
      mql.removeEventListener('change', onMotionChange)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height={VIEW_H}
      aria-hidden
      className="block overflow-visible pointer-events-none"
    >
      <defs>
        <clipPath id={clipId}>
          <rect ref={clipRectRef} x="0" y="0" width="0" height={VIEW_H} />
        </clipPath>
      </defs>

      {/* Dim outline — right of playhead */}
      <path
        d={path}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={Math.max(1.5, barW * 0.65)}
        strokeLinecap="round"
        fill="none"
      />

      {/* Filled + glow — left of playhead */}
      <path
        d={path}
        stroke="var(--song-color)"
        strokeWidth={Math.max(1.5, barW * 0.65)}
        strokeLinecap="round"
        fill="none"
        clipPath={`url(#${clipId})`}
        style={{ filter: 'drop-shadow(0 0 4px color-mix(in oklch, var(--song-color) 80%, transparent))' }}
      />

      {/* Playhead line — per-song color */}
      <line
        ref={playlineRef}
        x1="0" y1="0" x2="0" y2={VIEW_H}
        stroke="color-mix(in oklch, var(--song-color) 80%, white 20%)"
        strokeWidth="1"
      />
    </svg>
  )
}
