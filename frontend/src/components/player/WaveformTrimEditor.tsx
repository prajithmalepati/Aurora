import { useEffect, useRef, useState, useCallback } from "react"
import type { PlaylistSong } from "@/types"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Play, Pause } from "lucide-react"
import { usePlayerStore } from "@/stores/playerStore"

interface WaveformTrimEditorProps {
  song: PlaylistSong
  playlistId: number
  open: boolean
  onClose: () => void
  onSaved: (startMs: number, endMs: number) => void
}

function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function parseFormattedTime(text: string): number | null {
  const m = text.match(/^(\d+):(\d{2})$/)
  if (!m) return null
  return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000
}

const CANVAS_HEIGHT = 300
const HANDLE_WIDTH = 10
const BAR_GAP = 1

type DragHandle = "start" | "end" | null

export function WaveformTrimEditor({ song, playlistId, open, onClose, onSaved }: WaveformTrimEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  const durationMs = (song.duration ?? 0) * 1000
  const currentSong = usePlayerStore((s) => s.currentSong)
  const seek = usePlayerStore((s) => s.seek)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isCurrent = currentSong?.id === song.id

  const [startMs, setStartMs] = useState(song.start_time_ms ?? 0)
  const [endMs, setEndMs] = useState(
    song.end_time_ms && song.end_time_ms > 0 ? song.end_time_ms : durationMs
  )
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<DragHandle>(null)
  const [hoveredHandle, setHoveredHandle] = useState<DragHandle>(null)
  const [editingStart, setEditingStart] = useState(false)
  const [editingEnd, setEditingEnd] = useState(false)
  const [startText, setStartText] = useState("")
  const [endText, setEndText] = useState("")

  // Reset state when song changes
  useEffect(() => {
    setStartMs(song.start_time_ms ?? 0)
    setEndMs(song.end_time_ms && song.end_time_ms > 0 ? song.end_time_ms : durationMs)
  }, [song.id, song.start_time_ms, song.end_time_ms, durationMs])

  // Parse waveform peaks
  const peaks = useCallback((): number[] => {
    if (!song.waveform_peaks) return []
    if (Array.isArray(song.waveform_peaks)) return song.waveform_peaks
    try {
      return JSON.parse(song.waveform_peaks as unknown as string)
    } catch {
      return []
    }
  }, [song.waveform_peaks])()

  // Convert ms to x position
  const msToX = useCallback(
    (ms: number, canvasWidth: number): number => {
      if (durationMs <= 0) return 0
      return (ms / durationMs) * canvasWidth
    },
    [durationMs]
  )

  // Convert x position to ms
  const xToMs = useCallback(
    (x: number, canvasWidth: number): number => {
      if (canvasWidth <= 0 || durationMs <= 0) return 0
      return Math.max(0, Math.min(durationMs, (x / canvasWidth) * durationMs))
    },
    [durationMs]
  )

  // Snap to nearest second
  const snapMs = (ms: number): number => Math.round(ms / 1000) * 1000

  // Find which handle is near a position
  const getHandleAtX = useCallback(
    (x: number, canvasWidth: number): DragHandle => {
      const startX = msToX(startMs, canvasWidth)
      const endX = msToX(endMs, canvasWidth)
      const threshold = HANDLE_WIDTH + 2
      if (Math.abs(x - startX) < threshold) return "start"
      if (Math.abs(x - endX) < threshold) return "end"
      return null
    },
    [startMs, endMs, msToX]
  )

  // Draw the waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = CANVAS_HEIGHT

    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, w, h)

    const barCount = peaks.length
    if (barCount === 0 || w <= 0) return

    const barWidth = Math.max(1, (w / barCount) - BAR_GAP)
    const startXPos = msToX(startMs, w)
    const endXPos = msToX(endMs, w)

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const x = (i / barCount) * w
      const barCenterX = x + barWidth / 2
      const amplitude = peaks[i] ?? 0
      const barH = Math.max(2, amplitude * (h * 0.85))
      const y = (h - barH) / 2

      const isSelected = barCenterX >= startXPos && barCenterX <= endXPos
      if (isSelected) {
        ctx.fillStyle = "rgba(94, 234, 212, 0.7)"
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)"
      }
      ctx.fillRect(x, y, barWidth, barH)
    }

    // Dim overlays for unselected regions
    // Left dim region
    if (startXPos > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.fillRect(0, 0, startXPos, h)
    }
    // Right dim region
    if (endXPos < w) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
      ctx.fillRect(endXPos, 0, w - endXPos, h)
    }

    // Draw handles
    const drawHandle = (xPos: number, isHovered: boolean) => {
      const handleH = h
      const handleW = HANDLE_WIDTH
      const hx = xPos - handleW / 2

      // Handle body
      ctx.fillStyle = isHovered
        ? "rgba(94, 234, 212, 0.9)"
        : "rgba(94, 234, 212, 0.6)"
      ctx.fillRect(hx, 0, handleW, handleH)

      // Grip lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"
      ctx.lineWidth = 1.5
      const gripX = xPos
      for (let gy = h * 0.35; gy <= h * 0.65; gy += 6) {
        ctx.beginPath()
        ctx.moveTo(gripX - 2, gy)
        ctx.lineTo(gripX + 2, gy)
        ctx.stroke()
      }
    }

    drawHandle(startXPos, hoveredHandle === "start" || dragging === "start")
    drawHandle(endXPos, hoveredHandle === "end" || dragging === "end")

    // Playhead
    if (isCurrent && isPlaying) {
      const seekMs = seek * 1000
      const seekX = msToX(seekMs, w)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(seekX, 0)
      ctx.lineTo(seekX, h)
      ctx.stroke()

      // Playhead glow
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)"
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(seekX, 4, 4, 0, Math.PI * 2)
      ctx.fillStyle = "white"
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }, [peaks, startMs, endMs, msToX, hoveredHandle, dragging, isCurrent, isPlaying, seek])

  // Animation loop for playhead
  useEffect(() => {
    if (!open) return
    let running = true
    const loop = () => {
      if (!running) return
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [open, draw])

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const handle = getHandleAtX(x, rect.width)
      if (handle) {
        setDragging(handle)
        e.preventDefault()
      }
    },
    [getHandleAtX]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left

      if (dragging) {
        const ms = snapMs(xToMs(x, rect.width))
        if (dragging === "start") {
          setStartMs(Math.min(ms, endMs - 1000))
        } else {
          setEndMs(Math.max(ms, startMs + 1000))
        }
      } else {
        const handle = getHandleAtX(x, rect.width)
        setHoveredHandle(handle)
        canvas.style.cursor = handle ? "ew-resize" : "default"
      }
    },
    [dragging, xToMs, getHandleAtX, startMs, endMs]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredHandle(null)
    setDragging(null)
  }, [])

  // Global mouse up listener for drag outside canvas
  useEffect(() => {
    if (!dragging) return
    const handleGlobalUp = () => setDragging(null)
    window.addEventListener("mouseup", handleGlobalUp)
    return () => window.removeEventListener("mouseup", handleGlobalUp)
  }, [dragging])

  // Global mouse move for drag outside canvas
  useEffect(() => {
    if (!dragging) return
    const handleGlobalMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ms = snapMs(xToMs(x, rect.width))
      if (dragging === "start") {
        setStartMs(Math.min(Math.max(0, ms), endMs - 1000))
      } else {
        setEndMs(Math.max(Math.min(durationMs, ms), startMs + 1000))
      }
    }
    window.addEventListener("mousemove", handleGlobalMove)
    return () => window.removeEventListener("mousemove", handleGlobalMove)
  }, [dragging, xToMs, startMs, endMs, durationMs])

  // Playback preview
  const handlePreview = useCallback(() => {
    if (!song.file_path) return
    const isCurrentlyPlaying = isCurrent && isPlaying
    if (isCurrentlyPlaying) {
      usePlayerStore.getState().togglePlay()
    } else {
      if (!isCurrent) {
        const asSong = {
          ...song,
          source: "local" as const,
          playlists: [],
          created_at: "",
          updated_at: "",
        }
        usePlayerStore.getState().playSong(asSong, [asSong])
      }
      // Seek to start position
      setTimeout(() => {
        usePlayerStore.getState().setSeek(startMs / 1000)
        if (!usePlayerStore.getState().isPlaying) {
          usePlayerStore.getState().togglePlay()
        }
      }, 100)
    }
  }, [song, isCurrent, isPlaying, startMs])

  const isInvalid = startMs >= endMs
  const trimDurationMs = endMs - startMs

  // Save handler
  const handleSave = async () => {
    if (isInvalid) return
    setSaving(true)
    try {
      // Trim is per-playlist (playlist_songs row), not a song attribute —
      // the songs PUT silently ignores these fields.
      const res = await api.patch<{ data: { start_time_ms: number; end_time_ms: number } }>(
        `/playlists/${playlistId}/songs/${song.id}/timing`,
        { start_time_ms: startMs, end_time_ms: endMs },
      )
      toast.success("Trim saved")
      onSaved(res.data.start_time_ms, res.data.end_time_ms)
      onClose()
    } catch {
      toast.error("Failed to save trim")
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px]">Trim Waveform</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Song info */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-medium text-[var(--aurora-text)] truncate">
                {song.title}
              </span>
              <span className="text-[12px] text-[var(--aurora-text-secondary)] truncate">
                {song.artist}
              </span>
            </div>
          </div>

          {/* Waveform canvas */}
          <div ref={containerRef} className="relative w-full" style={{ height: CANVAS_HEIGHT }}>
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg"
              style={{ height: CANVAS_HEIGHT }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
            {peaks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[13px] text-[var(--aurora-text-tertiary)]">
                  No waveform data available
                </span>
              </div>
            )}
          </div>

          {/* Time displays */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="label-micro text-[10px] text-[var(--aurora-text-tertiary)] w-8">
                Start
              </span>
              {editingStart ? (
                <input
                  type="text"
                  value={startText}
                  autoFocus
                  onChange={(e) => setStartText(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFormattedTime(startText)
                    if (parsed !== null) setStartMs(Math.min(parsed, endMs - 1000))
                    setEditingStart(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") setEditingStart(false)
                  }}
                  className="w-14 text-center text-[13px] bg-[var(--aurora-surface-3)] border border-[var(--aurora-rim)] rounded px-1 py-0.5 text-[var(--aurora-text)] outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setStartText(formatMs(startMs))
                    setEditingStart(true)
                  }}
                  className="w-14 text-center text-[13px] tabular-nums text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors"
                >
                  {formatMs(startMs)}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--aurora-accent-interactive)] tabular-nums">
                {formatMs(trimDurationMs)} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="label-micro text-[10px] text-[var(--aurora-text-tertiary)] w-8 text-right">
                End
              </span>
              {editingEnd ? (
                <input
                  type="text"
                  value={endText}
                  autoFocus
                  onChange={(e) => setEndText(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFormattedTime(endText)
                    if (parsed !== null) setEndMs(Math.max(parsed, startMs + 1000))
                    setEditingEnd(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") setEditingEnd(false)
                  }}
                  className="w-14 text-center text-[13px] bg-[var(--aurora-surface-3)] border border-[var(--aurora-rim)] rounded px-1 py-0.5 text-[var(--aurora-text)] outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setEndText(formatMs(endMs))
                    setEditingEnd(true)
                  }}
                  className="w-14 text-center text-[13px] tabular-nums text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors"
                >
                  {formatMs(endMs)}
                </button>
              )}
            </div>
          </div>

          {isInvalid && (
            <p className="text-[11px] text-[var(--aurora-danger)]">
              Start time must be before end time
            </p>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={handlePreview}
              disabled={!song.file_path}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.06] transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none"
            >
              {isCurrent && isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isCurrent && isPlaying ? "Pause" : "Preview"}
            </button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || isInvalid}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
