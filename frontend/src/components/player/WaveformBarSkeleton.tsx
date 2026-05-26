export function WaveformBarSkeleton() {
  return (
    <div
      className="w-full rounded"
      style={{
        height: '32px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'waveform-shimmer 1.5s ease-in-out infinite',
      }}
      aria-hidden
    />
  )
}
