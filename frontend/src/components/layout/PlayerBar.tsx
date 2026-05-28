import { usePlayerStore } from "@/stores/playerStore"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { formatDuration } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1 } from "lucide-react"
import { motion } from "motion/react"
import { AuroraPlayButton } from "@/components/player/AuroraPlayButton"
import { WaveformBar } from '@/components/player/WaveformBar'

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
  const repeatMode = usePlayerStore((state) => state.repeatMode)
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat)
  const isShuffled = usePlayerStore((state) => state.isShuffled)
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle)
  const isBuffering = usePlayerStore((state) => state.isBuffering)

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
      <div className="player-bleed" aria-hidden />
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
            <motion.div
              key={currentSong.id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
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
                  </>
                ) : (
                  <span className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </motion.div>

            {/* Seek bar row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--aurora-text-secondary)] w-8 text-right tabular-nums">
                {formatDuration(seek)}
              </span>
              <div className="relative flex-1" style={{ height: '32px' }}>
                {hasSong && <WaveformBar duration={duration} seek={seek} />}
                <input
                  type="range"
                  aria-label="Seek"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  min={0}
                  max={duration || 100}
                  step={1}
                  value={Math.round(seek)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  disabled={!hasSong}
                />
              </div>
              <span className="text-[10px] text-[var(--aurora-text-tertiary)] w-8 tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>

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
                onClick={() => { if (seek > 3) seekTo(0); else { seekTo(0); previous() } }}
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
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP layout — spring height between idle (52px) and playing (80px) ── */}
      <motion.div
        animate={{ height: isIdle ? 52 : 80 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="hidden sm:block overflow-hidden"
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
            <motion.div
              key={currentSong.id}
              className="flex items-center gap-3.5 w-[240px] min-w-[160px] flex-shrink-0"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
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
                  </>
                ) : (
                  <span className="font-display-italic text-[15px] text-[var(--aurora-text-tertiary)]">
                    Nothing playing
                  </span>
                )}
              </div>
            </motion.div>

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
                  onClick={() => { if (seek > 3) seekTo(0); else { seekTo(0); previous() } }}
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
              </div>

              <div className="flex items-center gap-3 w-full">
                <span className="text-[11px] text-[var(--aurora-text-secondary)] w-9 text-right tabular-nums font-medium">
                  {formatDuration(seek)}
                </span>
                <div className="relative flex-1" style={{ height: '32px' }}>
                  {hasSong && <WaveformBar duration={duration} seek={seek} />}
                  <input
                    type="range"
                    aria-label="Seek"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    min={0}
                    max={duration || 100}
                    step={1}
                    value={Math.round(seek)}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    disabled={!hasSong}
                  />
                </div>
                <span className="text-[11px] text-[var(--aurora-text-tertiary)] w-9 tabular-nums font-medium">
                  {formatDuration(duration)}
                </span>
              </div>
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
      </motion.div>
    </div>
  )
}
