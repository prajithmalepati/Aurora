import { useRef, useId } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuroraPlayButtonProps {
  variant: 'player-desktop' | 'player-mobile' | 'row'
  isPlaying: boolean
  isBuffering?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent) => void
  ariaLabel?: string
}

// ─── Row variant ─────────────────────────────────────────────────────────────
function RowPlayButton({ onClick, ariaLabel }: Pick<AuroraPlayButtonProps, 'onClick' | 'ariaLabel'>) {
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

// ─── Liquid glass player button ──────────────────────────────────────────────
// CSS+SVG path: SVG feDisplacementMap on backdrop gives lens refraction in
// Chromium. Safari falls back to blur-only. Pointer-tracked specular on desktop.
function LiquidPlayerButton({
  variant,
  isPlaying,
  isBuffering = false,
  disabled = false,
  onClick,
  ariaLabel,
}: Omit<AuroraPlayButtonProps, 'variant'> & { variant: 'player-desktop' | 'player-mobile' }) {
  const filterId    = useId().replace(/:/g, '')
  const buttonRef   = useRef<HTMLButtonElement>(null)
  const isDesktop   = variant === 'player-desktop'
  const iconSize    = isDesktop ? 18 : 16

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top)  / rect.height
    e.currentTarget.style.setProperty('--mx', `${x * 100}%`)
    e.currentTarget.style.setProperty('--my', `${y * 100}%`)
    e.currentTarget.style.setProperty('--dx', `${(x - 0.5).toFixed(3)}`)
    e.currentTarget.style.setProperty('--dy', `${(y - 0.5).toFixed(3)}`)
  }

  function handlePointerLeave(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.style.setProperty('--mx', '50%')
    e.currentTarget.style.setProperty('--my', '28%')
    e.currentTarget.style.setProperty('--dx', '0')
    e.currentTarget.style.setProperty('--dy', '-0.22')
  }

  return (
    <>
      {/* SVG filter definition — zero-size, GPU-backed by Chromium compositor */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute', pointerEvents: 'none' }}
        aria-hidden
      >
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="6" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="softNoise"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
              result="refracted"
            />
            {/* Chromatic edge dispersion — isolate R/G/B, offset outward/anchored/inward */}
            <feColorMatrix in="refracted" type="matrix" result="rIso"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            <feOffset in="rIso" dx="-1.2" dy="-1.2" result="rShift" />
            <feColorMatrix in="refracted" type="matrix" result="gIso"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            <feColorMatrix in="refracted" type="matrix" result="bIso"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
            <feOffset in="bIso" dx="1.2" dy="1.2" result="bShift" />
            <feMerge result="chromatic">
              <feMergeNode in="rShift" />
              <feMergeNode in="gIso" />
              <feMergeNode in="bShift" />
            </feMerge>
            {/* Vibrancy boost — compensates for OLED black eating saturation through blur */}
            <feColorMatrix in="chromatic" type="matrix"
              values="1.18 0 0 0 0  0 1.18 0 0 0  0 0 1.22 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      <button
        ref={buttonRef}
        onClick={onClick}
        disabled={disabled}
        onPointerMove={isDesktop ? handlePointerMove : undefined}
        onPointerLeave={isDesktop ? handlePointerLeave : undefined}
        style={{
          '--mx': '50%',
          '--my': '28%',
          '--dx': '0',
          '--dy': '-0.22',
        } as React.CSSProperties}
        className={cn(
          "relative isolation-isolate flex items-center justify-center rounded-full",
          isDesktop ? "w-11 h-11" : "w-10 h-10",
          // Outer ring
          "border border-white/[0.20]",
          // Depth shadows — outer drop + chromatic inset edges
          "shadow-[0_10px_32px_rgba(0,0,0,0.40),0_3px_12px_rgba(20,190,255,0.08),inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.38),inset_1px_0_1px_rgba(255,80,180,0.18),inset_-1px_0_1px_rgba(60,220,255,0.20)]",
          // Press deformation
          "transition-[transform,border-radius,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.965] active:rounded-[18px]",
          "disabled:opacity-40 disabled:pointer-events-none",
          "[contain:paint]",
        )}
        aria-label={ariaLabel ?? (isPlaying ? 'Pause' : 'Play')}
      >
        {/*
          REFRACTION LAYER — absolute, behind icon.
          backdrop-filter here, NOT on the button container, so the icon is NOT warped.
          Chromium: url(#id) applies SVG displacement to pixels behind the button.
          Safari / Firefox: blur-only fallback (graceful degradation via comma-separated syntax).
        */}
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{
            backdropFilter: `url(#${filterId}) blur(3px) saturate(1.5) brightness(1.10) contrast(1.06)`,
            WebkitBackdropFilter: `blur(3px) saturate(1.5) brightness(1.10) contrast(1.06)`,
          }}
        />

        {/*
          ILLUMINATION LAYER — soft inner glow + pointer-reactive specular.
          mix-blend-mode: screen lets it add light without darkening.
        */}
        <div
          className="absolute inset-[2px] rounded-full pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 50% 55%, transparent 42%, rgba(255,255,255,0.14) 62%, transparent 74%),
              radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.26), transparent 22%)
            `,
            mixBlendMode: 'screen',
            opacity: 0.88,
          }}
        />

        {/*
          SPECULAR SWEEP LAYER — hard glint following pointer direction.
          Extended inset to avoid clip on pointer drift.
        */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '-35%',
            borderRadius: 'inherit',
            background: `
              radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.70), rgba(255,255,255,0.18) 9%, transparent 20%),
              linear-gradient(118deg, transparent 30%, rgba(255,255,255,0.32) 43%, rgba(255,255,255,0.07) 49%, transparent 57%)
            `,
            transform: `translate3d(calc(var(--dx, 0) * 7px), calc(var(--dy, -0.22) * 7px), 0) rotate(0.001deg)`,
            opacity: 0.68,
            mixBlendMode: 'screen',
          }}
        />

        {/* BUFFERING shimmer ring */}
        {isBuffering && (
          <span className="absolute inset-0 rounded-full pointer-events-none star-buffering" />
        )}

        {/* ICON — localized dimming behind glyph for OLED legibility */}
        <span className="relative z-10 grid place-items-center"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))' }}
        >
          {isPlaying
            ? <Pause size={iconSize} strokeWidth={1.5} className="text-white/92" />
            : <Play  size={iconSize} strokeWidth={1.5} className="text-white/92 translate-x-[1px]" />
          }
        </span>
      </button>
    </>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────
export function AuroraPlayButton(props: AuroraPlayButtonProps) {
  if (props.variant === 'row') {
    return <RowPlayButton onClick={props.onClick} ariaLabel={props.ariaLabel} />
  }
  return <LiquidPlayerButton {...props} variant={props.variant as 'player-desktop' | 'player-mobile'} />
}
