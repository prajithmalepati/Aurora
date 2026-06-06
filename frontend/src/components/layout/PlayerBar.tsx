import { usePlayerStore } from "@/stores/playerStore"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ListMusic, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { AuroraPlayButton } from "@/components/player/AuroraPlayButton"
import { SeekScrubber } from "@/components/player/SeekScrubber"
import { QueuePanel } from "@/components/player/QueuePanel"
import { useState, useEffect } from "react"
import { formatFileSize, qualityLabel } from "@/lib/utils"
import { api } from "@/lib/api"
import type { Song } from "@/types"

function AudioMetadataLine({ song }: { song: Song }) {
  const fmt = song.file_format
  const quality = qualityLabel(song)
  const size = formatFileSize(song.file_size)
  if (!fmt && !quality && !size) return null
  const parts = [fmt?.toUpperCase(), quality, size].filter(Boolean)
  return (
    <span className="text-[9px] text-[var(--aurora-text-tertiary)] truncate mt-0.5">
      {parts.join(" · ")}
    </span>
  )
}

export function PlayerBar() {
  const { seekTo } = useAudioPlayer()
  const currentSong = usePlayerStore((state) => state.currentSong)
  const [bleedThumbUrl, setBleedThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!currentSong) { setBleedThumbUrl(null); return }
    let cancelled = false
    api.get<{ url: string }>(`/songs/${currentSong.id}/bleed-thumb`)
      .then((res) => { if (!cancelled) setBleedThumbUrl(res.url) })
      .catch(() => { if (!cancelled) setBleedThumbUrl(null) })
    return () => { cancelled = true }
  }, [currentSong?.id])
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const toggleMute = usePlayerStore((state) => state.toggleMute)
  const togglePlay = usePlayerStore((state) => state.togglePlay)
  const next = usePlayerStore((state) => state.next)
  const previous = usePlayerStore((state) => state.previous)
  const repeatMode = usePlayerStore((state) => state.repeatMode)
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat)
  const isShuffled = usePlayerStore((state) => state.isShuffled)
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle)
  const isBuffering = usePlayerStore((state) => state.isBuffering)
  const queue = usePlayerStore((state) => state.queue)
  const isCrossfading = usePlayerStore((state) => state.isCrossfading)
  const crossfadeFromTitle = usePlayerStore((state) => state.crossfadeFromTitle)

  const [queueOpen, setQueueOpen] = useState(false)

  // isIdle = no song ever selected (initial app load only).
  // Once currentSong is set it never returns to null, so this only fires once.
  const isIdle = currentSong === null
  const hasSong = currentSong !== null && currentSong.file_path !== null

  const volumePct = Math.min(100, volume * 100)

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat
  const repeatActive = repeatMode !== "none"
  const repeatLabel = repeatMode === "none" ? "Repeat off" : repeatMode === "all" ? "Repeat all" : "Repeat one"
  const transportBtnClass = (active: boolean) =>
    `transition-colors duration-150 disabled:opacity-25 disabled:pointer-events-none ${
      active
        ? "text-[var(--aurora-accent-interactive)]"
        : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
    }`

  return (
    <div
      className="aurora-keyline-top col-span-1 md:col-span-2 relative"
      style={{
        background: "var(--aurora-surface-bar)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Bleed glow — album art bright region diffused as ambient light */}
      {currentSong && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-60px',
            backgroundImage: bleedThumbUrl
              ? `url(${bleedThumbUrl})`
              : currentSong.dominant_color
                ? `linear-gradient(135deg, ${currentSong.dominant_color}, transparent)`
                : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(60px) saturate(2.2) brightness(1.4)',
            maskImage: 'radial-gradient(closest-side, black, transparent)',
            WebkitMaskImage: 'radial-gradient(closest-side, black, transparent)',
            mixBlendMode: 'screen',
            opacity: 0.15,
            pointerEvents: 'none',
            transition: 'opacity 0.4s ease-out',
          }}
        />
      )}
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
            <AnimatePresence mode="wait">
            <motion.div
              key={currentSong.id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            >
              <div className="flex-shrink-0">
                <AlbumArt
                  song={currentSong!}
                  size="sm"
                  style={{
                    boxShadow: 'var(--halo-art)',
                  }}
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                {hasSong ? (
                  <>
                    <span
                      className="font-display text-[15px] leading-tight text-[var(--aurora-text)] truncate"
                    >
                      {currentSong.title}
                    </span>
                    <span className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
                      {currentSong.artist}
                    </span>
                    <AudioMetadataLine song={currentSong!} />
                    {/* Crossfade indicator */}
                    {isCrossfading && crossfadeFromTitle && (
                      <div className="flex items-center gap-1 mt-0.5 aurora-fade-in">
                        <Sparkles className="h-2.5 w-2.5 text-[var(--aurora-accent-interactive)] flex-shrink-0" />
                        <span className="text-[9px] text-[var(--aurora-text-tertiary)] truncate">
                          from <span className="text-[var(--aurora-accent-interactive)]">{crossfadeFromTitle}</span>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </motion.div>
            </AnimatePresence>

            {/* Seek bar row */}
            <SeekScrubber hasSong={hasSong} seekTo={seekTo} mobile />

            {/* Controls row */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleShuffle}
                disabled={!hasSong}
                className={transportBtnClass(isShuffled)}
                aria-label={isShuffled ? "Shuffle on" : "Shuffle off"}
              >
                <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>

              <button
                onClick={() => { if (usePlayerStore.getState().seek > 3) seekTo(0); else { seekTo(0); previous() } }}
                disabled={!hasSong}
                className={transportBtnClass(false)}
                aria-label="Previous"
              >
                <SkipBack className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>

              <AuroraPlayButton
                variant="player-mobile"
                isPlaying={isPlaying}
                isBuffering={isBuffering}
                disabled={!hasSong}
                onClick={togglePlay}
              />

              <button
                onClick={next}
                disabled={!hasSong}
                className={transportBtnClass(false)}
                aria-label="Next"
              >
                <SkipForward className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>

              <button
                onClick={cycleRepeat}
                disabled={!hasSong}
                className={transportBtnClass(repeatActive)}
                aria-label={repeatLabel}
              >
                <RepeatIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>

              <button
                onClick={() => setQueueOpen(true)}
                disabled={!hasSong}
                className={`${transportBtnClass(false)} relative`}
                aria-label="Open queue"
              >
                <ListMusic className="h-3.5 w-3.5" strokeWidth={1.5} />
                {queue.length > 1 && (
                  <span className="absolute -top-0.5 -right-1.5 text-[8px] tabular-nums text-[var(--aurora-text-tertiary)] leading-none">
                    {queue.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP layout — static height, content fades in/out ── */}
      <div className={`hidden sm:block ${isIdle ? 'h-[52px]' : 'h-[96px]'}`}>
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
          <div className="flex items-center h-[96px] px-8 gap-8 aurora-view-enter">
            {/* LEFT: Album art + title/artist */}
            <AnimatePresence mode="wait">
            <motion.div
              key={currentSong.id}
              className="flex items-center gap-3.5 w-[240px] min-w-[160px] flex-shrink-0"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            >
              <div className="relative flex-shrink-0">
                <AlbumArt
                  song={currentSong!}
                  size="md"
                  style={{
                    boxShadow: 'var(--halo-art)',
                  }}
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                {hasSong ? (
                  <>
                    <span
                      className="font-display text-[18px] leading-tight text-[var(--aurora-text)] truncate"
                    >
                      {currentSong.title}
                    </span>
                    <span className="text-[11px] text-[var(--aurora-text-secondary)] truncate mt-0.5 tracking-wide">
                      {currentSong.artist}
                    </span>
                    <AudioMetadataLine song={currentSong!} />
                    {/* Crossfade indicator */}
                    {isCrossfading && crossfadeFromTitle && (
                      <div className="flex items-center gap-1.5 mt-1 aurora-fade-in">
                        <Sparkles className="h-3 w-3 text-[var(--aurora-accent-interactive)] flex-shrink-0" />
                        <span className="text-[10px] text-[var(--aurora-text-tertiary)] truncate">
                          from <span className="text-[var(--aurora-accent-interactive)]">{crossfadeFromTitle}</span>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="font-display-italic text-[15px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </motion.div>
            </AnimatePresence>

            {/* CENTER: Controls + seek bar */}
            <div className="flex-1 flex flex-col items-center gap-2 max-w-[580px] mx-auto min-w-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleShuffle}
                  disabled={!hasSong}
                  className={transportBtnClass(isShuffled)}
                  aria-label={isShuffled ? "Shuffle on" : "Shuffle off"}
                >
                  <Shuffle className="h-[15px] w-[15px]" strokeWidth={1.5} />
                </button>

                <button
                  onClick={() => { if (usePlayerStore.getState().seek > 3) seekTo(0); else { seekTo(0); previous() } }}
                  disabled={!hasSong}
                  className={transportBtnClass(false)}
                  aria-label="Previous"
                >
                  <SkipBack className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>

                <AuroraPlayButton
                  variant="player-desktop"
                  isPlaying={isPlaying}
                  isBuffering={isBuffering}
                  disabled={!hasSong}
                  onClick={togglePlay}
                />

                <button
                  onClick={next}
                  disabled={!hasSong}
                  className={transportBtnClass(false)}
                  aria-label="Next"
                >
                  <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>

                <button
                  onClick={cycleRepeat}
                  disabled={!hasSong}
                  className={transportBtnClass(repeatActive)}
                  aria-label={repeatLabel}
                >
                  <RepeatIcon className="h-[15px] w-[15px]" strokeWidth={1.5} />
                </button>

                <button
                  onClick={() => setQueueOpen(true)}
                  disabled={!hasSong}
                  className={`${transportBtnClass(false)} relative`}
                  aria-label="Open queue"
                >
                  <ListMusic className="h-[15px] w-[15px]" strokeWidth={1.5} />
                  {queue.length > 1 && (
                    <span className="absolute -top-0.5 -right-1.5 text-[9px] tabular-nums text-[var(--aurora-text-tertiary)] leading-none">
                      {queue.length}
                    </span>
                  )}
                </button>
              </div>

              <SeekScrubber hasSong={hasSong} seekTo={seekTo} />
            </div>

            {/* RIGHT: Now-playing indicator + volume */}
            <div className="w-[200px] flex-shrink-0 flex items-center gap-3 justify-end">
              {hasSong && isPlaying && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Equalizer playing={isPlaying} />
                </div>
              )}

              <div className="flex items-center gap-2 min-w-0 w-[110px] flex-shrink-0">
                <button
                  onClick={toggleMute}
                  className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 flex-shrink-0"
                  aria-label={volume > 0 ? "Mute" : "Unmute"}
                >
                  {volume > 0 ? (
                    <Volume2 className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <VolumeX className="h-4 w-4" strokeWidth={1.5} />
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

      <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  )
}
