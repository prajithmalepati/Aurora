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

  return (
    <div className={`flex items-center gap-3${mobile ? "" : " w-full"}`}>
      <span
        className={`${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-secondary)] text-right tabular-nums`}
      >
        {formatDuration(seek)}
      </span>
      <div className="relative flex-1" style={{ height: "32px" }}>
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
      <span
        className={`${mobile ? "text-[10px] w-8" : "text-[11px] w-9 font-medium"} text-[var(--aurora-text-tertiary)] tabular-nums`}
      >
        {formatDuration(duration)}
      </span>
    </div>
  )
}
