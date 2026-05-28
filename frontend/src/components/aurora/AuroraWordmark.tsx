// Library Label — Fraunces upright Roman, generous tracking, no star/glow.
// Communicates: private curated collection, archival, owned object.
export function AuroraWordmark({ className }: { className?: string }) {
  return (
    <svg
      width="116"
      height="26"
      viewBox="0 0 116 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Aurora"
    >
      {/* Fraunces upright Roman, opsz 144 (display), SOFT 0 (sharp), weight 500.
          Tracking +0.02em — breathable, generous, archival.
          No italic. No star. No glow. Pure white on OLED black. */}
      <text
        x="1"
        y="21"
        fontFamily="'Fraunces Variable', Fraunces, serif"
        fontSize="21"
        fontWeight="500"
        fontStyle="normal"
        fill="rgb(238 242 250)"
        letterSpacing="0.02em"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
      >
        Aurora
      </text>
    </svg>
  )
}
