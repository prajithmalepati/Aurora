import { useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { oklchToLinearRgb, BRAND_TEAL_LINEAR } from '@/hooks/useAuroraColor'
import { GlassButtonGL } from './GlassButtonGL'

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
  const sizePx = isDesktop ? 44 : isRow ? 36 : 40
  const iconSize = isDesktop ? 18 : isRow ? 14 : 16

  const currentSong = usePlayerStore((s) => s.currentSong)
  const [glFailed, setGlFailed] = useState(false)
  const useGL = isPrimary && !glFailed

  // Song colors drive the glass field; fall back to brand teal when idle.
  const color1 = currentSong?.dominant_color ? oklchToLinearRgb(currentSong.dominant_color) : BRAND_TEAL_LINEAR
  const color2 = currentSong?.dominant_color_2 ? oklchToLinearRgb(currentSong.dominant_color_2) : BRAND_TEAL_LINEAR

  // CSS-fallback specular tracking (desktop only). GL handles its own pointer.
  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    e.currentTarget.style.setProperty('--mx', `${x * 100}%`)
    e.currentTarget.style.setProperty('--my', `${y * 100}%`)
    e.currentTarget.style.setProperty('--dx', `${(x - 0.5).toFixed(3)}`)
    e.currentTarget.style.setProperty('--dy', `${(y - 0.5).toFixed(3)}`)
  }
  function handlePointerLeave(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.style.setProperty('--mx', '50%')
    e.currentTarget.style.setProperty('--my', '25%')
    e.currentTarget.style.setProperty('--dx', '0')
    e.currentTarget.style.setProperty('--dy', '-0.25')
  }

  const materialClass = useGL ? 'glass-play-btn--gl' : 'css-only'
  const variantClass = isPrimary ? 'glass-play-btn--primary' : 'glass-play-btn--row'
  const rowPosition = isRow
    ? ' absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150'
    : ''

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerMove={!useGL && isDesktop ? handlePointerMove : undefined}
      onPointerLeave={!useGL && isDesktop ? handlePointerLeave : undefined}
      style={{
        '--mx': '50%',
        '--my': '25%',
        '--dx': '0',
        '--dy': '-0.25',
      } as React.CSSProperties}
      className={`glass-play-btn ${materialClass} ${variantClass} ${sizeClass}${rowPosition} disabled:opacity-40 disabled:pointer-events-none`}
      aria-label={ariaLabel ?? (isPlaying ? 'Pause' : 'Play')}
      tabIndex={isRow ? -1 : 0}
    >
      {useGL ? (
        <GlassButtonGL size={sizePx} color1={color1} color2={color2} onFail={() => setGlFailed(true)} />
      ) : (
        <>
          <div className="glass-play-btn__refraction" aria-hidden="true" />
          <div className="glass-play-btn__tint" aria-hidden="true" />
        </>
      )}
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
