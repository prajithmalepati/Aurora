import { cn } from "@/lib/utils"

interface EqualizerProps {
  playing?: boolean
  className?: string
}

/**
 * Three animated vertical bars using CSS keyframes defined in index.css.
 * Used as the "currently playing" indicator — aurora gradient fill.
 */
export function Equalizer({ playing = true, className }: EqualizerProps) {
  return (
    <span
      className={cn("aurora-eq", !playing && "aurora-eq-paused", className)}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  )
}
