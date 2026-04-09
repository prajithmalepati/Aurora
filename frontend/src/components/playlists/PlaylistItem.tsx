import type { Playlist } from "@/types"

interface PlaylistItemProps {
  playlist: Playlist
  isActive: boolean
  onSelect: (playlistId: number) => void
}

export function PlaylistItem({ playlist, isActive, onSelect }: PlaylistItemProps) {
  const dotColor = playlist.color ?? "#5eead4"

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
          isActive ? "h-4 opacity-100" : "h-0 opacity-0"
        }`}
        style={{
          background: "linear-gradient(to bottom, #5eead4, #86efac)",
          boxShadow: isActive ? "0 0 8px rgba(94, 234, 212, 0.6)" : "none",
        }}
        aria-hidden="true"
      />
      {isActive && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at left, rgba(94,234,212,0.07) 0%, transparent 70%)",
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

      {/* Colored dot with whisper glow */}
      <span
        className="relative z-10 w-[6px] h-[6px] rounded-full flex-shrink-0"
        style={{
          backgroundColor: dotColor,
          boxShadow: `0 0 6px ${dotColor}80`,
        }}
      />
      {/* Name */}
      <span className="relative z-10 flex-1 text-[13px] truncate leading-tight">
        {playlist.emoji ? `${playlist.emoji} ` : ""}
        {playlist.name}
      </span>
      {/* Count */}
      <span className="relative z-10 text-[10px] tabular-nums text-[var(--aurora-text-muted)] flex-shrink-0">
        {playlist.song_count}
      </span>
    </button>
  )
}
