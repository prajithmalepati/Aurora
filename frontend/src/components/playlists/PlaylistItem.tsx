import type { Playlist } from "@/types"

interface PlaylistItemProps {
  playlist: Playlist
  isActive: boolean
  onSelect: (playlistId: number) => void
}

export function PlaylistItem({ playlist, isActive, onSelect }: PlaylistItemProps) {
  const dotColor = playlist.color ?? "#00C9A7"

  return (
    <button
      onClick={() => onSelect(playlist.id)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left rounded transition-colors ${
        isActive
          ? "bg-[var(--aurora-bg-hover)] border-l-3 border-[var(--aurora-teal)]"
          : "hover:bg-[var(--aurora-bg-hover)]"
      }`}
    >
      {/* Colored dot (8px circle) */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {/* Playlist name */}
      <span className="flex-1 text-sm text-[var(--aurora-text)] truncate">
        {playlist.emoji ? `${playlist.emoji} ` : ""}{playlist.name}
      </span>
      {/* Song count in dim text */}
      <span className="text-xs text-[var(--aurora-text-dim)] flex-shrink-0">
        {playlist.song_count}
      </span>
    </button>
  )
}