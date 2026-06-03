import { Play, Pause } from 'lucide-react'

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
  const isDesktop = variant === 'player-desktop'
  const isRow = variant === 'row'
  const isPrimary = variant === 'player-desktop' || variant === 'player-mobile'

  const sizeClass = isDesktop ? 'w-11 h-11' : isRow ? 'w-9 h-9' : 'w-10 h-10'
  const iconSize = isDesktop ? 18 : isRow ? 14 : 16

  const variantClass = isPrimary ? 'glass-play-btn--primary' : 'glass-play-btn--row'

  // Row variant is a plain circle; the consumer wraps it in an inset-0 flex overlay
  // that centers it in the cell (avoids the table-cell percentage-positioning bug).
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-play-btn ${variantClass} ${sizeClass} disabled:opacity-40 disabled:pointer-events-none`}
      aria-label={ariaLabel ?? (isPlaying ? 'Pause' : 'Play')}
      tabIndex={isRow ? -1 : 0}
    >
      {isBuffering && (
        <span className="absolute inset-0 rounded-full pointer-events-none star-buffering" />
      )}
      <span className="glass-play-btn__icon">
        {isPlaying
          ? <Pause size={iconSize} strokeWidth={1.5} />
          : <Play  size={iconSize} strokeWidth={1.5} className="translate-x-[1px]" />
        }
      </span>
    </button>
  )
}
