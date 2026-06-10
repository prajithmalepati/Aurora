import type { Playlist } from "@/types"
import { playlistThumbnail } from "@/lib/playlistImage"
import { getBaseUrl } from "@/lib/api"

interface PlaylistItemProps {
  playlist: Playlist
  isActive: boolean
  onSelect: (playlistId: number) => void
}

export function PlaylistItem({ playlist, isActive, onSelect }: PlaylistItemProps) {
  const storedImage = playlist.image_url ? `${getBaseUrl()}${playlist.image_url}` : null
  const gradient = playlistThumbnail(playlist.name)

  return (
    <button
      onClick={() => onSelect(playlist.id)}
      className={`group relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-left transition-colors duration-200 active:bg-white/[0.03] ${
        isActive
          ? "text-[var(--aurora-text)]"
          : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active indicator — 3px left bar, solid primary */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-[height,opacity] duration-200 ${
          isActive ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        style={{
          background: "var(--aurora-accent-interactive)",
          boxShadow: isActive ? "0 0 8px var(--aurora-accent-interactive-glow)" : "none",
        }}
        aria-hidden="true"
      />
      {/* Active background */}
      {isActive && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{ background: "var(--aurora-surface)" }}
          aria-hidden="true"
        />
      )}
      {/* Thumbnail — 32x32 square */}
      <span className="relative z-10 flex-shrink-0">
        {storedImage ? (
          <img
            src={storedImage}
            alt=""
            className="w-8 h-8 rounded object-cover"
          />
        ) : (
          <span
            className="block w-8 h-8 rounded"
            style={{ background: gradient }}
          />
        )}
      </span>

      {/* Name + count */}
      <span className="relative z-10 flex-1 min-w-0 flex flex-col">
        <span className="text-[13px] truncate leading-tight font-medium">
          {playlist.emoji ? `${playlist.emoji} ` : ""}
          {playlist.name}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--aurora-text-tertiary)]">
          {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
        </span>
      </span>
    </button>
  )
}
