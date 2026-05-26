import { Play, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuroraPlayButtonProps {
  variant: 'player-desktop' | 'player-mobile' | 'row'
  isPlaying: boolean
  isBuffering?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent) => void
  ariaLabel?: string
}

export function AuroraPlayButton({
  variant,
  isPlaying,
  isBuffering = false,
  disabled = false,
  onClick,
  ariaLabel,
}: AuroraPlayButtonProps) {
  if (variant === 'row') {
    return (
      <button
        className="aurora-play-btn absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 hover:scale-105"
        onClick={onClick}
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        <Play className="h-4 w-4 text-[var(--aurora-slate)] ml-[2px]" fill="currentColor" strokeWidth={0} />
      </button>
    )
  }

  const isDesktop = variant === 'player-desktop'
  const iconSize = isDesktop ? 18 : 16

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center rounded-full",
        isDesktop ? "w-11 h-11" : "w-10 h-10",
        "[contain:paint]",
        "backdrop-blur-md",
        "[background:radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)]",
        "border border-white/[0.18]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.3)]",
        "transition-transform duration-75 active:scale-[0.94]",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
      aria-label={ariaLabel ?? (isPlaying ? 'Pause' : 'Play')}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none transition-all duration-300",
          isBuffering && "star-buffering",
        )}
        style={{
          background: isBuffering
            ? undefined
            : `radial-gradient(circle, oklch(0.97 0.04 185 / ${isPlaying ? '1.0' : '0.5'}) 0%, oklch(0.78 0.18 185 / 0) 70%)`,
        }}
      />
      {isPlaying
        ? <Pause size={iconSize} strokeWidth={1.5} className="relative z-10 text-white/90" />
        : <Play  size={iconSize} strokeWidth={1.5} className="relative z-10 text-white/90" />
      }
    </button>
  )
}
