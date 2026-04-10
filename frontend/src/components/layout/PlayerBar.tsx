import { usePlayerStore } from "@/stores/playerStore"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { formatDuration } from "@/lib/utils"
import { albumGradient } from "@/lib/albumGradient"
import { Equalizer } from "@/components/ui/Equalizer"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import { useMemo } from "react"

export function PlayerBar() {
  const { seekTo } = useAudioPlayer()
  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const seek = usePlayerStore((state) => state.seek)
  const duration = usePlayerStore((state) => state.duration)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const toggleMute = usePlayerStore((state) => state.toggleMute)
  const togglePlay = usePlayerStore((state) => state.togglePlay)
  const next = usePlayerStore((state) => state.next)
  const previous = usePlayerStore((state) => state.previous)

  const hasSong = currentSong !== null && currentSong.file_path !== null

  const seekPct = duration > 0 ? Math.min(100, (seek / duration) * 100) : 0
  const volumePct = Math.min(100, volume * 100)

  const art = useMemo(
    () => albumGradient(currentSong?.id ?? currentSong?.title ?? "void"),
    [currentSong?.id, currentSong?.title]
  )

  return (
    <div
      className="aurora-keyline-top col-span-2 relative px-6 py-4"
      style={{
        background: "rgba(6,7,9,0.75)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <div className="flex items-center gap-8 h-[72px]">
        {/* ───── LEFT: Album art + title/artist ───── */}
        <div className="flex items-center gap-3.5 w-[280px] min-w-[220px]">
          <div className="relative flex-shrink-0">
            <div
              className="w-[56px] h-[56px] rounded-md overflow-hidden aurora-rim"
              style={{
                background: art.background,
                boxShadow: hasSong
                  ? `0 0 24px -6px ${art.glow}, inset 0 0 0 1px rgba(255,255,255,0.06)`
                  : "inset 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {/* Inner shine — a soft top-left highlight */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.08) 0%, transparent 50%)",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {hasSong ? (
              <>
                <span className="font-display text-[18px] leading-tight text-[var(--aurora-text)] truncate">
                  {currentSong.title}
                </span>
                <span className="text-[11px] text-[var(--aurora-text-dim)] truncate mt-0.5 tracking-wide">
                  {currentSong.artist}
                </span>
              </>
            ) : (
              <span className="font-display-italic text-[15px] text-[var(--aurora-text-muted)]">
                Nothing playing
              </span>
            )}
          </div>
        </div>

        {/* ───── CENTER: Controls + seek bar ───── */}
        <div className="flex-1 flex flex-col items-center gap-2 max-w-[620px] mx-auto">
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                if (seek > 3) seekTo(0)
                else previous()
              }}
              disabled={!hasSong}
              className="text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
              aria-label="Previous"
            >
              <SkipBack className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
            </button>

            {/* THE play button — the single saturated element */}
            <button
              onClick={togglePlay}
              disabled={!hasSong}
              className={`relative h-11 w-11 rounded-full flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none transition-transform duration-150 active:scale-[0.94] ${
                hasSong && isPlaying ? "aurora-pulse" : ""
              }`}
              style={{
                background: "var(--aurora-gradient)",
                boxShadow: hasSong
                  ? "0 0 28px -6px rgba(94, 234, 212, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
                  : "none",
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-[18px] w-[18px] text-[#050608]" fill="#050608" strokeWidth={0} />
              ) : (
                <Play className="h-[18px] w-[18px] ml-[2px] text-[#050608]" fill="#050608" strokeWidth={0} />
              )}
            </button>

            <button
              onClick={next}
              disabled={!hasSong}
              className="text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
              aria-label="Next"
            >
              <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
            </button>
          </div>

          <div className="flex items-center gap-3 w-full">
            <span className="text-[10.5px] text-[var(--aurora-text-dim)] w-9 text-right tabular-nums font-medium">
              {formatDuration(seek)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={seek}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!hasSong}
              className="aurora-range flex-1"
              style={{ ["--aurora-range-pct" as string]: `${seekPct}%` }}
              aria-label="Seek"
            />
            <span className="text-[10.5px] text-[var(--aurora-text-muted)] w-9 tabular-nums font-medium">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* ───── RIGHT: Now-playing indicator + volume ───── */}
        <div className="w-[240px] flex-shrink-0 flex items-center gap-3 justify-end">
          {hasSong && isPlaying && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Equalizer playing={isPlaying} />
              <span className="label-micro text-[9.5px] text-[var(--aurora-teal-dim)] whitespace-nowrap">
                Playing
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0 w-[110px] flex-shrink-0">
            <button
              onClick={toggleMute}
              className="text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] transition-colors duration-150 flex-shrink-0"
              aria-label={volume > 0 ? "Mute" : "Unmute"}
            >
              {volume > 0 ? (
                <Volume2 className="h-4 w-4" strokeWidth={2} />
              ) : (
                <VolumeX className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="aurora-range flex-1 min-w-0"
              style={{ ["--aurora-range-pct" as string]: `${volumePct}%` }}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
