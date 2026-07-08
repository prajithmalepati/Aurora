/**
 * Build a display string for a song's artist credit.
 *
 * Priority:
 *   1. If the song has an `artists` array with entries, join them with ", "
 *      and append featured artists as " feat. X, Y".
 *   2. Otherwise fall back to the scalar `artist` field.
 *   3. Final fallback: "Unknown Artist".
 */
export function displayArtist(song: {
  artist?: string | null
  artists?: string[] | null
  featured_artists?: string[] | null
}): string {
  const primary =
    song.artists && song.artists.length > 0
      ? song.artists.join(", ")
      : song.artist || ""

  if (!primary && (!song.featured_artists || song.featured_artists.length === 0)) {
    return "Unknown Artist"
  }

  if (song.featured_artists && song.featured_artists.length > 0) {
    const feat = song.featured_artists.join(", ")
    return primary ? `${primary} feat. ${feat}` : `feat. ${feat}`
  }

  return primary || "Unknown Artist"
}
