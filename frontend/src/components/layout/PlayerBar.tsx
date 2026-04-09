import { usePlayerStore } from "@/stores/playerStore"
import { useAudioPlayer } from "@/hooks/useAudioPlayer"
import { formatDuration } from "@/lib/utils"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"

export function PlayerBar() {
  const { seekTo } = useAudioPlayer()
  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const seek = usePlayerStore((state) => state.seek)
  const duration = usePlayerStore((state) => state.duration)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const togglePlay = usePlayerStore((state) => state.togglePlay)
  const next = usePlayerStore((state) => state.next)
  const previous = usePlayerStore((state) => state.previous)

  const hasSong = currentSong !== null && currentSong.file_path !== null

  return (
    <div className="bg-[var(--aurora-bg-surface)] border-t border-[var(--aurora-border)] pl-6 pr-10 py-3 col-span-2">
      <div className="flex items-center gap-6 h-[72px]">
        {/* Left: Song info */}
        <div className="w-[200px] min-w-[150px] overflow-hidden">
          {hasSong ? (
            <div className="flex flex-col">
              <span className="font-medium text-sm text-[var(--aurora-text)] truncate">
                {currentSong.title}
              </span>
              <span className="text-xs text-[var(--aurora-text-dim)] truncate">
                {currentSong.artist}
              </span>
            </div>
          ) : (
            <span className="text-sm text-[var(--aurora-text-muted)]">No song playing</span>
          )}
        </div>

        {/* Center: Controls + Seek */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                if (seek > 3) {
                  seekTo(0)
                } else {
                  previous()
                }
              }}
              disabled={!hasSong}
              className={`hover:text-[var(--aurora-text)] transition-colors ${!hasSong ? "opacity-30 pointer-events-none" : "text-[var(--aurora-text-dim)]"}`}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!hasSong}
              className={`hover:text-[var(--aurora-teal)] transition-colors ${!hasSong ? "opacity-30 pointer-events-none" : "text-[var(--aurora-text)]"}`}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <button
              onClick={next}
              disabled={!hasSong}
              className={`hover:text-[var(--aurora-text)] transition-colors ${!hasSong ? "opacity-30 pointer-events-none" : "text-[var(--aurora-text-dim)]"}`}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-[500px]">
            <span className="text-[10px] text-[var(--aurora-text-muted)] w-8 text-right tabular-nums">
              {formatDuration(seek)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={seek}
              onChange={(e) => seekTo(Number(e.target.value))}
              disabled={!hasSong}
              className="flex-1 h-1 appearance-none bg-[var(--aurora-border-bright)] rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer disabled:opacity-30"
            />
            <span className="text-[10px] text-[var(--aurora-text-muted)] w-8 tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume */}
        <div className="w-[110px] flex-shrink-0 flex items-center gap-2 mr-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.7)}
            className="text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] transition-colors"
          >
            {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={!hasSong}
               className="w-20 h-1 appearance-none bg-[var(--aurora-border-bright)] rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer disabled:opacity-30"
            />
        </div>
      </div>
    </div>
  )
}