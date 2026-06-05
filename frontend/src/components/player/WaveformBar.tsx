import { useId, useRef, useEffect, useCallback, useMemo } from 'react'

interface WaveformBarProps {
  duration: number
  seek: number
  dragSeek?: number | null
  waveformPeaks?: number[] | null
}

const VIEW_W = 600
const VIEW_H = 32
const MID_Y  = VIEW_H / 2

const FREQ   = 0.042  // spatial cycles per viewBox unit
const SPEED  = 0.7    // seconds-per-cycle divisor
const AMP    = VIEW_H * 0.30  // max pixel deviation from midline
const STEPS  = 120    // path resolution (600 / 5)

function buildWavePath(t: number, phase: number, ampScale: number): string {
  const pts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * VIEW_W
    const y = MID_Y + Math.sin(x * FREQ + t * SPEED + phase) * AMP * ampScale
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join('')
}

function buildPeaksPath(peaks: number[], maxBars: number): string {
  if (!peaks.length) return ''
  // Sample peaks to fit the viewport
  const step = Math.max(1, Math.floor(peaks.length / maxBars))
  const barWidth = VIEW_W / maxBars
  const pts: string[] = []
  for (let i = 0; i < maxBars; i++) {
    const idx = Math.min(i * step, peaks.length - 1)
    // peaks are 0-1, map to 1..MID_Y*2 pixels (center-out)
    const val = Math.max(0, Math.min(1, peaks[idx]))
    const barH = Math.max(1, val * (VIEW_H - 2))
    const x = i * barWidth
    const y = (VIEW_H - barH) / 2
    pts.push(`M${x.toFixed(1)},${y.toFixed(1)}h${barWidth.toFixed(1)}v${barH.toFixed(1)}h${-barWidth.toFixed(1)}Z`)
  }
  return pts.join('')
}

// PURELY VISUAL — aria-hidden, pointer-events-none.
// Seek interaction handled by native <input type="range"> overlaid in PlayerBar.
export function WaveformBar({ duration, seek, dragSeek, waveformPeaks }: WaveformBarProps) {
  const clipId      = useId()
  const wave1DimRef = useRef<SVGPathElement>(null)
  const wave2DimRef = useRef<SVGPathElement>(null)
  const wave1LitRef = useRef<SVGPathElement>(null)
  const wave2LitRef = useRef<SVGPathElement>(null)
  const clipRectRef = useRef<SVGRectElement>(null)
  const playlineRef = useRef<SVGLineElement>(null)
  const rafRef      = useRef<number | null>(null)
  const startRef    = useRef<number>(performance.now())
  const seekRef     = useRef(seek)
  const durationRef = useRef(duration)
  const dragSeekRef = useRef(dragSeek)

  seekRef.current    = seek
  durationRef.current = duration
  dragSeekRef.current = dragSeek

  // Active playhead position: use dragSeek if dragging, otherwise seek
  const playheadX = useMemo(() => {
    const s = dragSeek != null ? dragSeek : seek
    if (!duration) return 0
    return (s / duration) * VIEW_W
  }, [seek, dragSeek, duration])

  // Precompute peaks path once when peaks change
  const peaksPath = useMemo(() => {
    if (!waveformPeaks || !waveformPeaks.length) return null
    return buildPeaksPath(waveformPeaks, 120)
  }, [waveformPeaks])

  // Under reduced-motion: write playhead position directly (RAF is stopped)
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!durationRef.current) return
    const x = playheadX
    clipRectRef.current?.setAttribute('width', String(x))
    playlineRef.current?.setAttribute('x1', String(x))
    playlineRef.current?.setAttribute('x2', String(x))
  }, [playheadX])

  const tick = useCallback(() => {
    const t    = (performance.now() - startRef.current) / 1000
    const d1   = buildWavePath(t, 0, 1)
    const d2   = buildWavePath(t, Math.PI * 0.62, 0.6)

    wave1DimRef.current?.setAttribute('d', d1)
    wave2DimRef.current?.setAttribute('d', d2)
    wave1LitRef.current?.setAttribute('d', d1)
    wave2LitRef.current?.setAttribute('d', d2)

    if (durationRef.current) {
      const s = dragSeekRef.current != null ? dragSeekRef.current : seekRef.current
      const x = (s / durationRef.current) * VIEW_W
      clipRectRef.current?.setAttribute('width', String(x))
      playlineRef.current?.setAttribute('x1', String(x))
      playlineRef.current?.setAttribute('x2', String(x))
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

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

      {/* Waveform peaks layer — static background, full width dimmed */}
      {peaksPath && (
        <path
          d={peaksPath}
          fill="rgba(255,255,255,0.06)"
          stroke="none"
        />
      )}

      {/* Waveform peaks layer — clipped to playhead, brighter */}
      {peaksPath && (
        <path
          d={peaksPath}
          fill="rgba(255,255,255,0.14)"
          stroke="none"
          clipPath={`url(#${clipId})`}
        />
      )}

      {/* Dim waves — full width, right of playhead */}
      <path ref={wave1DimRef} d="" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path ref={wave2DimRef} d="" stroke="rgba(255,255,255,0.07)" strokeWidth="1"   fill="none" strokeLinecap="round" />

      {/* Lit waves — clipped to left of playhead */}
      <path
        ref={wave1LitRef}
        d=""
        stroke="var(--song-color)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
        style={{ filter: 'drop-shadow(0 0 3px color-mix(in oklch, var(--song-color) 70%, transparent))' }}
      />
      <path
        ref={wave2LitRef}
        d=""
        stroke="var(--song-color-2, rgba(255,255,255,0.35))"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />

      {/* Playhead line */}
      <line
        ref={playlineRef}
        x1="0" y1="0" x2="0" y2={VIEW_H}
        stroke="color-mix(in oklch, var(--song-color) 80%, white 20%)"
        strokeWidth="1.5"
      />
    </svg>
  )
}
