import { usePlayerStore } from "@/stores/playerStore"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { formatDuration } from "@/lib/utils"
import { albumGradient } from "@/lib/albumGradient"
import { AlbumArt } from "@/components/songs/AlbumArt"
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

  // isIdle = no song ever selected (initial app load only).
  // Once currentSong is set it never returns to null, so this only fires once.
  const isIdle = currentSong === null
  const hasSong = currentSong !== null && currentSong.file_path !== null

  const seekPct = duration > 0 ? Math.min(100, (seek / duration) * 100) : 0
  const volumePct = Math.min(100, volume * 100)

  const art = useMemo(
    () => albumGradient(currentSong?.id ?? currentSong?.title ?? "void"),
    [currentSong?.id, currentSong?.title]
  )

  return (
    <div
      className="aurora-keyline-top col-span-1 md:col-span-2 relative"
      style={{
        background: "var(--aurora-surface-bar)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* ── MOBILE layout ── */}
      <div className="sm:hidden">
        {isIdle ? (
          <div className="flex items-center h-[44px] px-4 gap-3">
            <div className="w-8 h-8 rounded-sm flex-shrink-0 aurora-idle-shimmer" />
            <div className="flex flex-col gap-px">
              <span className="font-display-italic text-[12px] leading-tight text-[var(--aurora-text-secondary)]">
                Nothing playing
              </span>
              <span className="text-[10px] text-[var(--aurora-text-tertiary)]">
                Pick a song or hit Jam
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Song info row */}
            <div className="flex items-center gap-3">
              <div key={currentSong.id} className="aurora-song-fade flex-shrink-0">
                <AlbumArt
                  song={currentSong!}
                  size="sm"
                  style={{
                    boxShadow: hasSong
                      ? `0 0 16px 0 ${art.glow}, inset 0 0 0 1px var(--aurora-rim)`
                      : "inset 0 0 0 1px rgba(255,255,255,0.05)",
                  }}
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                {hasSong ? (
                  <>
                    <span
                      key={currentSong.id}
                      className="font-display text-[15px] leading-tight text-[var(--aurora-text)] truncate aurora-song-fade"
                    >
                      {currentSong.title}
                    </span>
                    <span className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
                      {currentSong.artist}
                    </span>
                  </>
                ) : (
                  <span className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </div>

            {/* Seek bar row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--aurora-text-secondary)] w-8 text-right tabular-nums">
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
                className="aurora-range aurora-focus flex-1"
                style={{ ["--aurora-range-pct" as string]: `${seekPct}%` }}
                aria-label="Seek"
              />
              <span className="text-[10px] text-[var(--aurora-text-tertiary)] w-8 tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => { if (seek > 3) seekTo(0); else previous() }}
                disabled={!hasSong}
                className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
                aria-label="Previous"
              >
                <SkipBack className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!hasSong}
                className="relative h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none aurora-btn-press aurora-play-btn"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play className="h-4 w-4 ml-[1px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                )}
              </button>
              <button
                onClick={next}
                disabled={!hasSong}
                className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
                aria-label="Next"
              >
                <SkipForward className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP layout — height transitions between idle (52px) and playing (80px) ── */}
      <div
        className="hidden sm:block overflow-hidden"
        style={{
          height: isIdle ? "52px" : "80px",
          transition: "height 300ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        }}
      >
        {isIdle ? (
          /* Idle: shimmer + text, no controls */
          <div className="flex items-center h-[52px] px-8 gap-4">
            <div className="w-[42px] h-[42px] rounded-md flex-shrink-0 aurora-idle-shimmer" />
            <div className="flex flex-col gap-0.5">
              <span className="font-display-italic text-[15px] leading-tight text-[var(--aurora-text)]">
                Nothing playing
              </span>
              <span className="text-[11px] text-[var(--aurora-text-tertiary)] tracking-wide">
                Pick a song or hit Jam
              </span>
            </div>
          </div>
        ) : (
          /* Playing / paused: full controls fade in as bar opens */
          <div className="flex items-center h-[80px] px-8 gap-8 aurora-view-enter">
            {/* LEFT: Album art + title/artist */}
            <div className="flex items-center gap-3.5 w-[240px] min-w-[160px] flex-shrink-0">
              <div key={currentSong.id} className="relative flex-shrink-0 aurora-song-fade">
                <AlbumArt
                  song={currentSong!}
                  size="md"
                  style={{
                    boxShadow: hasSong
                      ? `0 0 24px 0 ${art.glow}, inset 0 0 0 1px var(--aurora-rim)`
                      : "inset 0 0 0 1px rgba(255,255,255,0.05)",
                  }}
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                {hasSong ? (
                  <>
                    <span
                      key={currentSong.id}
                      className="font-display text-[18px] leading-tight text-[var(--aurora-text)] truncate aurora-song-fade"
                    >
                      {currentSong.title}
                    </span>
                    <span className="text-[11px] text-[var(--aurora-text-secondary)] truncate mt-0.5 tracking-wide">
                      {currentSong.artist}
                    </span>
                  </>
                ) : (
                  <span className="font-display-italic text-[15px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </div>

            {/* CENTER: Controls + seek bar */}
            <div className="flex-1 flex flex-col items-center gap-2 max-w-[580px] mx-auto min-w-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (seek > 3) seekTo(0)
                    else previous()
                  }}
                  disabled={!hasSong}
                  className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
                  aria-label="Previous"
                >
                  <SkipBack className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>

                <button
                  onClick={togglePlay}
                  disabled={!hasSong}
                  className="relative h-11 w-11 rounded-full flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none aurora-btn-press aurora-play-btn"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-[18px] w-[18px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play className="h-[18px] w-[18px] ml-[2px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                  )}
                </button>

                <button
                  onClick={next}
                  disabled={!hasSong}
                  className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
                  aria-label="Next"
                >
                  <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>
              </div>

              <div className="flex items-center gap-3 w-full">
                <span className="text-[10.5px] text-[var(--aurora-text-secondary)] w-9 text-right tabular-nums font-medium">
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
                  className="aurora-range aurora-focus flex-1"
                  style={{ ["--aurora-range-pct" as string]: `${seekPct}%` }}
                  aria-label="Seek"
                />
                <span className="text-[10.5px] text-[var(--aurora-text-tertiary)] w-9 tabular-nums font-medium">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* RIGHT: Now-playing indicator + volume */}
            <div className="w-[200px] flex-shrink-0 flex items-center gap-3 justify-end">
              {hasSong && isPlaying && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Equalizer playing={isPlaying} />
                  <span className="label-micro text-[9.5px] text-[var(--aurora-accent-interactive)] whitespace-nowrap opacity-70">
                    Playing
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 min-w-0 w-[110px] flex-shrink-0">
                <button
                  onClick={toggleMute}
                  className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 flex-shrink-0"
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
                  className="aurora-range aurora-focus flex-1 min-w-0"
                  style={{ ["--aurora-range-pct" as string]: `${volumePct}%` }}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
