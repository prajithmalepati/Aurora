import { useRef, useState, useCallback, useEffect } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { formatDuration } from "@/lib/utils"

interface SeekScrubberProps {
  hasSong: boolean
  seekTo: (seconds: number) => void
  mobile?: boolean
}

const SEEK_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown",
])

export function SeekScrubber({ hasSong, seekTo, mobile = false }: SeekScrubberProps) {
  const seek = usePlayerStore((state) => state.seek)
  const duration = usePlayerStore((state) => state.duration)
  const isBuffering = usePlayerStore((state) => state.isBuffering)
  const startTimeMs = usePlayerStore((state) => state.currentSong?.start_time_ms)
  const endTimeMs = usePlayerStore((state) => state.currentSong?.end_time_ms)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDraggingRef = useRef(false)
  const instantTimerRef = useRef<number | null>(null)

  // Drag state for smooth scrubbing
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState<number | null>(null)
  // Discrete seeks (keyboard/wheel) suppress the fill's catch-up transition for 1:1 response
  const [instant, setInstant] = useState(false)

  // Hover state for time tooltip
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Update container width for hover calculations
  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.getBoundingClientRect().width)
    }
  }, [])

  // Fill percentage drives every visual layer via --seek-pct on the container
  const currentVal = dragValue ?? seek
  const pct = duration > 0 ? (currentVal / duration) * 100 : 0

  useEffect(() => {
    containerRef.current?.style.setProperty("--seek-pct", `${pct}%`)
  }, [pct])

  const markInstant = useCallback(() => {
    setInstant(true)
    if (instantTimerRef.current) window.clearTimeout(instantTimerRef.current)
    instantTimerRef.current = window.setTimeout(() => setInstant(false), 300)
  }, [])

  useEffect(() => {
    return () => {
      if (instantTimerRef.current) window.clearTimeout(instantTimerRef.current)
    }
  }, [])

  // --- Drag handlers for smooth scrubbing ---
  const handlePointerDown = useCallback(() => {
    isDraggingRef.current = true
    setIsDragging(true)
    updateContainerWidth()
  }, [updateContainerWidth])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value)
      setDragValue(val)
      if (!isDraggingRef.current) {
        seekTo(val)
      }
    },
    [seekTo]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      isDraggingRef.current = false
      setIsDragging(false)
      const val = Number((e.target as HTMLInputElement).value)
      setDragValue(null)
      seekTo(val)
    },
    [seekTo]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (SEEK_KEYS.has(e.key)) markInstant()
    },
    [markInstant]
  )

  // --- Hover handlers ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updateContainerWidth()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
      setHoverX(x)
    },
    [updateContainerWidth]
  )

  const handleMouseLeave = useCallback(() => {
    setHoverX(null)
  }, [])

  // --- Wheel seek ---
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!hasSong || !duration) return
      e.preventDefault()
      const delta = e.ctrlKey || e.metaKey ? 30 : 5
      const direction = e.deltaY > 0 ? 1 : -1
      const currentSeek = dragValue ?? seek
      const target = Math.max(0, Math.min(duration, currentSeek + direction * delta))
      markInstant()
      seekTo(target)
    },
    [hasSong, duration, seek, dragValue, seekTo, markInstant]
  )

  // Hover time calculation
  const hoverTime = hoverX !== null && containerWidth > 0 && duration > 0
    ? (hoverX / containerWidth) * duration
    : null

  // Tooltip: follows the cursor on hover; follows the thumb while dragging
  const thumbX = containerWidth > 0 ? (pct / 100) * containerWidth : null
  const tooltipX = isDragging ? thumbX : hoverX
  const tooltipTime = isDragging ? (dragValue ?? seek) : hoverTime
  const showTooltip = hasSong && tooltipX !== null && tooltipTime !== null

  // Trim-point notches (playlist trim: start_time_ms / end_time_ms)
  const notches: number[] = []
  if (duration > 0) {
    if (startTimeMs && startTimeMs > 0) {
      notches.push(Math.min(100, (startTimeMs / 1000 / duration) * 100))
    }
    if (endTimeMs && endTimeMs > 0) {
      notches.push(Math.min(100, (endTimeMs / 1000 / duration) * 100))
    }
  }

  return (
    <div className={`scrub-row flex items-center gap-3${mobile ? "" : " w-full"}`}>
      <span
        className={`scrub-time ${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-secondary)] text-right tabular-nums`}
      >
        {formatDuration(seek)}
      </span>
      <div
        ref={containerRef}
        className="scrub flex-1"
        data-dragging={isDragging || undefined}
        data-instant={instant || undefined}
        data-buffering={(hasSong && isBuffering) || undefined}
        data-disabled={!hasSong || undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {/* Visual layers — pointer-events-none, behind the input */}
        <div className="scrub-visual" aria-hidden="true">
          <div className="scrub-track" />
          <div className="scrub-shimmer" />
          <div className="scrub-fill">
            <div className="scrub-comet" />
          </div>
          {notches.map((n, i) => (
            <div key={i} className="scrub-notch" style={{ left: `${n}%` }} />
          ))}
        </div>
        <div className="scrub-thumb" aria-hidden="true" />

        {/* Invisible native range input — full 24px hitbox, a11y, keyboard */}
        <input
          ref={inputRef}
          type="range"
          aria-label="Seek"
          className="scrub-input"
          min={0}
          max={duration || 100}
          step={1}
          value={Math.round(dragValue ?? seek)}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          disabled={!hasSong}
        />

        {/* Time tooltip — cursor-anchored on hover, thumb-anchored while dragging */}
        {showTooltip && (
          <div
            className="pointer-events-none absolute top-[-26px] z-20 px-2 py-0.5 rounded text-[11px] font-medium tabular-nums bg-black/80 text-white border border-white/10 shadow-lg whitespace-nowrap"
            style={{
              left: `${tooltipX}px`,
              transform: "translateX(-50%)",
            }}
          >
            {formatDuration(tooltipTime)}
          </div>
        )}
      </div>
      <span
        className={`scrub-time ${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-tertiary)] tabular-nums`}
      >
        {formatDuration(duration)}
      </span>
    </div>
  )
}
