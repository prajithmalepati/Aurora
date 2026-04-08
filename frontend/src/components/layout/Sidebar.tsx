type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const isActive = (view: View) => {
    if (view.kind === "playlist" && currentView.kind === "playlist") {
      return currentView.playlistId === view.playlistId
    }
    return currentView.kind === view.kind
  }

  return (
    <aside className="w-60 bg-[var(--aurora-bg-surface)] border-l border-[var(--aurora-border)] flex flex-col">
      {/* Aurora logo */}
      <div className="p-4">
        <h1 className="text-2xl font-[Outfit] text-[var(--aurora-teal)]">Aurora</h1>
      </div>

      {/* All Songs button */}
      <button
        onClick={() => onViewChange({ kind: "all-songs" })}
        className={`mx-4 px-4 py-2 text-left rounded transition-colors ${
          isActive({ kind: "all-songs" })
            ? "bg-[var(--aurora-bg-hover)] border-l-3 border-[var(--aurora-teal)]"
            : "hover:bg-[var(--aurora-bg-hover)]"
        }`}
      >
        All Songs
      </button>

      {/* Filter View button */}
      <button
        onClick={() => onViewChange({ kind: "filter" })}
        className={`mx-4 px-4 py-2 text-left rounded transition-colors ${
          isActive({ kind: "filter" })
            ? "bg-[var(--aurora-bg-hover)] border-l-3 border-[var(--aurora-teal)]"
            : "hover:bg-[var(--aurora-bg-hover)]"
        }`}
      >
        Filter View
      </button>

      {/* Divider */}
      <div className="mx-4 my-2 border-t border-[var(--aurora-border)]" />

      {/* Playlists label */}
      <div className="px-4 py-2 text-sm text-[var(--aurora-text-dim)]">Playlists</div>

      {/* Playlist list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-sm text-[var(--aurora-text-muted)] px-4 py-2">
          Playlists will appear here
        </div>
      </div>

      {/* + New Playlist button */}
      <button className="mx-4 mb-2 px-4 py-2 text-left bg-[var(--aurora-bg-hover)] rounded hover:bg-opacity-80 transition-colors">
        + New Playlist
      </button>

      {/* Scan Folder button */}
      <button className="mx-4 mb-4 px-4 py-2 text-left bg-[var(--aurora-bg-hover)] rounded hover:bg-opacity-80 transition-colors">
        Scan Folder
      </button>
    </aside>
  )
}