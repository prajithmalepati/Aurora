// Star at A apex + plain fill lettering — no gradient on letterforms
export function AuroraWordmark({ className }: { className?: string }) {
  return (
    <svg
      width="112"
      height="30"
      viewBox="0 0 112 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Aurora"
    >
      <defs>
        <radialGradient id="star-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="oklch(0.95 0.06 185)" stopOpacity="1" />
          <stop offset="35%"  stopColor="oklch(0.78 0.18 185)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 185)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Star glow — positioned at apex of the "A" */}
      <ellipse cx="11" cy="2" rx="11" ry="11" fill="url(#star-bloom)" />
      {/* Star hard core */}
      <circle cx="11" cy="2" r="2.2" fill="oklch(0.97 0.04 185)" />

      {/* Wordmark text — Fraunces italic, plain fill, NO gradient */}
      <text
        x="1"
        y="25"
        fontFamily="'Fraunces Variable', Fraunces, serif"
        fontSize="22"
        fontWeight="400"
        fontStyle="italic"
        fill="rgb(232 238 248)"
        letterSpacing="-0.02em"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
      >
        Aurora
      </text>
    </svg>
  )
}
