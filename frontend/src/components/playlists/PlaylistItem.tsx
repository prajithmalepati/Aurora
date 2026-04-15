import type { Playlist } from "@/types"
import { playlistThumbnail } from "@/lib/playlistImage"

interface PlaylistItemProps {
  playlist: Playlist
  isActive: boolean
  onSelect: (playlistId: number) => void
}

export function PlaylistItem({ playlist, isActive, onSelect }: PlaylistItemProps) {
  const storedImage = playlist.image_url ?? null
  const gradient = playlistThumbnail(playlist.name)

  return (
    <button
      onClick={() => onSelect(playlist.id)}
      className={`group relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-left transition-all duration-200 ${
        isActive
          ? "text-[var(--aurora-text)]"
          : "text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active indicator bar */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r-full transition-all duration-300 ${
          isActive ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        style={{
          background: "linear-gradient(to bottom, #5eead4, #86efac, #a78bfa)",
          boxShadow: isActive ? "0 0 10px rgba(94, 234, 212, 0.5), 0 0 10px rgba(167, 139, 250, 0.3)" : "none",
        }}
        aria-hidden="true"
      />
      {isActive && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at left, rgba(94,234,212,0.06) 0%, rgba(134,239,172,0.03) 40%, rgba(167,139,250,0.04) 80%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute inset-0 rounded-md bg-white/[0.02] transition-opacity duration-200 pointer-events-none ${
          isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}
        aria-hidden="true"
      />

      {/* Thumbnail — 32x32 square */}
      <span className="relative z-10 flex-shrink-0">
        {storedImage ? (
          <img
            src={storedImage}
            alt=""
            className="w-8 h-8 rounded-sm object-cover"
          />
        ) : (
          <span
            className="block w-8 h-8 rounded-sm"
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
        <span className="text-[10px] tabular-nums text-[var(--aurora-text-muted)]">
          {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
        </span>
      </span>
    </button>
  )
}
