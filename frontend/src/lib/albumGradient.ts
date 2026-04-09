/**
 * Procedural album art — generates a deterministic abstract gradient
 * from a song id or title. Subtle, dark, cool-toned. The aurora family.
 *
 * Used as a placeholder when no album art is available.
 */

// Curated hue anchors from the aurora palette — cold cyans, mints, violets, deep indigos.
// Each gradient picks two of these, offset so neighbors always feel like the same family.
const HUES = [
  { h: 168, s: 72, l: 52 }, // teal
  { h: 150, s: 65, l: 55 }, // mint
  { h: 195, s: 70, l: 50 }, // cyan
  { h: 210, s: 60, l: 48 }, // ice blue
  { h: 255, s: 55, l: 55 }, // violet
  { h: 275, s: 50, l: 50 }, // purple
  { h: 230, s: 55, l: 45 }, // indigo
  { h: 135, s: 55, l: 45 }, // forest mint
]

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export interface AlbumGradient {
  background: string
  glow: string
}

/**
 * Deterministic dark gradient based on a song's identity.
 * Muted toward black — these are backgrounds for 48–80px tiles, not hero images.
 */
export function albumGradient(seed: string | number): AlbumGradient {
  const key = String(seed ?? "void")
  const hash = hashString(key)

  const i1 = hash % HUES.length
  const i2 = (i1 + 3 + ((hash >> 8) % 3)) % HUES.length
  const a = HUES[i1]
  const b = HUES[i2]

  const angle = (hash >> 4) % 360

  // Pull toward black — these are dim glow placeholders, not saturated posters.
  const dimA = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.32)`
  const dimB = `hsla(${b.h}, ${b.s}%, ${b.l}%, 0.22)`

  const background = `
    radial-gradient(ellipse at 30% 20%, ${dimA} 0%, transparent 55%),
    radial-gradient(ellipse at 80% 90%, ${dimB} 0%, transparent 60%),
    linear-gradient(${angle}deg, #0a0c11 0%, #06080b 100%)
  `.trim()

  const glow = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.25)`

  return { background, glow }
}
