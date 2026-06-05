import { useRef, useState, useCallback } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { formatDuration } from "@/lib/utils"
import { WaveformBar } from "@/components/player/WaveformBar"

interface SeekScrubberProps {
  hasSong: boolean
  seekTo: (seconds: number) => void
  mobile?: boolean
}

export function SeekScrubber({ hasSong, seekTo, mobile = false }: SeekScrubberProps) {
  const seek = usePlayerStore((state) => state.seek)
  const duration = usePlayerStore((state) => state.duration)
  const currentSong = usePlayerStore((state) => state.currentSong)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDraggingRef = useRef(false)

  // Drag state for smooth scrubbing
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState<number | null>(null)

  // Hover state for time tooltip
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Update container width for hover calculations
  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.getBoundingClientRect().width)
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
      // During drag, don't commit seek — wait for pointerup
      // For pure click (no move), isDraggingRef is true from pointerdown
      // but we still defer to pointerup for visual consistency
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
      seekTo(target)
    },
    [hasSong, duration, seek, dragValue, seekTo]
  )

  // Hover time calculation
  const hoverTime = hoverX !== null && containerWidth > 0 && duration > 0
    ? (hoverX / containerWidth) * duration
    : null

  // Waveform peaks from current song
  const waveformPeaks = currentSong?.waveform_peaks ?? null

  return (
    <div className={`flex items-center gap-3${mobile ? "" : " w-full"}`}>
      <span
        className={`${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-secondary)] text-right tabular-nums`}
      >
        {formatDuration(seek)}
      </span>
      <div
        ref={containerRef}
        className="relative flex-1 group"
        style={{ height: "32px" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {hasSong && (
          <WaveformBar
            duration={duration}
            seek={seek}
            dragSeek={dragValue}
            waveformPeaks={waveformPeaks}
          />
        )}
        <input
          ref={inputRef}
          type="range"
          aria-label="Seek"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          min={0}
          max={duration || 100}
          step={1}
          value={Math.round(dragValue ?? seek)}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          disabled={!hasSong}
        />

        {/* Hover time tooltip */}
        {hoverTime !== null && !isDragging && (
          <div
            className="pointer-events-none absolute top-[-26px] z-20 px-2 py-0.5 rounded text-[11px] font-medium tabular-nums bg-black/80 text-white border border-white/10 shadow-lg whitespace-nowrap"
            style={{
              left: `${hoverX! + 8}px`,
              transform: "translateX(-50%)",
            }}
          >
            {formatDuration(hoverTime)}
          </div>
        )}
      </div>
      <span
        className={`${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-tertiary)] tabular-nums`}
      >
        {formatDuration(duration)}
      </span>
    </div>
  )
}
