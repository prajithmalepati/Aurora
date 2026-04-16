type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { useFilterStore } from "@/stores/filterStore"
import { PlaylistItem } from "@/components/playlists/PlaylistItem"
import { CreatePlaylistDialog } from "@/components/playlists/CreatePlaylistDialog"
import { ScanDialog } from "@/components/scanner/ScanDialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { Library, SlidersHorizontal, Plus, FolderSearch, Music } from "lucide-react"
import { AddSongDialog } from "@/components/songs/AddSongDialog"

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [addSongOpen, setAddSongOpen] = useState(false)
  const playlists = usePlaylistStore((state) => state.playlists)
  const playlistsLoading = usePlaylistStore((state) => state.loading)
  const tags = useTagStore((state) => state.tags)
  const tagsLoading = useTagStore((state) => state.loading)
  const setQuery = useFilterStore((state) => state.setQuery)
  const executeFilter = useFilterStore((state) => state.executeFilter)

  const handleTagClick = (tagName: string) => {
    const term = tagName.includes(" ") ? `"${tagName}"` : tagName
    setQuery(term)
    onViewChange({ kind: "filter" })
    setTimeout(() => {
      executeFilter()
    }, 0)
  }

  const isActive = (view: View) => {
    if (view.kind === "playlist" && currentView.kind === "playlist") {
      return currentView.playlistId === view.playlistId
    }
    return currentView.kind === view.kind
  }

  return (
    <>
      <aside className="w-60 h-full flex flex-col bg-[#050608]/60 backdrop-blur-xl">
        {/* Brand lockup */}
        <div className="px-6 pt-7 pb-5">
          <button
            onClick={() => onViewChange({ kind: "all-songs" })}
            className="font-display text-[34px] leading-none tracking-tight aurora-gradient-text select-none hover:opacity-80 transition-opacity duration-150"
          >
            Aurora
          </button>
          {/* Thin aurora gradient line beneath logo */}
          <div
            className="mt-3 h-[1px] w-12"
            style={{
              background: "linear-gradient(to right, var(--aurora-primary), var(--aurora-secondary))",
              opacity: 0.4,
            }}
          />
        </div>

        {/* Primary nav */}
        <nav className="px-3 space-y-0.5">
          <NavItem
            icon={<Library className="h-4 w-4" />}
            label="All Songs"
            active={isActive({ kind: "all-songs" })}
            onClick={() => onViewChange({ kind: "all-songs" })}
          />
          <NavItem
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label="Mix"
            active={isActive({ kind: "filter" })}
            onClick={() => onViewChange({ kind: "filter" })}
          />
        </nav>

        {/* Divider */}
        <div className="aurora-divider-h mx-6 my-5" />

        {/* Scrollable middle: Playlists + Tags */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Playlists section header */}
          <div className="px-6 mb-2 flex items-center justify-between">
            <span className="label-micro">Playlists</span>
            <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
              {playlists.length}
            </span>
          </div>

          <div className="px-3 pb-1">
            {playlistsLoading ? (
              <div className="space-y-1 px-1 py-1">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ) : playlists.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                  No playlists yet
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {playlists.map((playlist) => (
                  <PlaylistItem
                    key={playlist.id}
                    playlist={playlist}
                    isActive={isActive({ kind: "playlist", playlistId: playlist.id })}
                    onSelect={(playlistId) => onViewChange({ kind: "playlist", playlistId })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Divider between sections */}
          <div className="aurora-divider-h mx-6 my-4" />

          {/* Tags section header */}
          <div className="px-6 mb-2 flex items-center justify-between">
            <span className="label-micro">Tags</span>
            <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
              {tags.length}
            </span>
          </div>

          <div className="px-3 pb-2">
            {tagsLoading ? (
              <div className="space-y-1 px-1 py-1">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full rounded-md" />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                  No tags yet
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tags.map((tag) => (
                  <TagSidebarItem
                    key={tag.id}
                    name={tag.name}
                    count={tag.song_count}
                    onClick={() => handleTagClick(tag.name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-3 pb-4 pt-2 space-y-0.5">
          <div className="aurora-divider-h mx-3 mb-3" />
          <FooterAction
            icon={<Plus className="h-3.5 w-3.5" />}
            label="New Playlist"
            onClick={() => setCreateDialogOpen(true)}
          />
          <FooterAction
            icon={<FolderSearch className="h-3.5 w-3.5" />}
            label="Scan Folder"
            onClick={() => setScanOpen(true)}
          />
          <FooterAction
            icon={<Music className="h-3.5 w-3.5" />}
            label="Add Song"
            onClick={() => setAddSongOpen(true)}
          />
        </div>
      </aside>

      <CreatePlaylistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <AddSongDialog open={addSongOpen} onOpenChange={setAddSongOpen} />
    </>
  )
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
        active
          ? "text-[var(--aurora-text)]"
          : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active indicator — 3px left bar, solid primary */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
          active ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        style={{
          background: "var(--aurora-primary)",
          boxShadow: active ? "0 0 8px var(--aurora-primary-glow)" : "none",
        }}
        aria-hidden="true"
      />
      {/* Active background */}
      {active && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{ background: "var(--aurora-surface)" }}
          aria-hidden="true"
        />
      )}
      {/* Hover background */}
      <span
        className={`absolute inset-0 rounded-md transition-opacity duration-200 pointer-events-none ${
          active ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ background: "var(--aurora-surface-hover)" }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex items-center gap-3">
        <span className={active ? "text-[var(--aurora-primary)]" : ""}>{icon}</span>
        <span className="font-medium tracking-tight">{label}</span>
      </span>
    </button>
  )
}

interface FooterActionProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function FooterAction({ icon, label, onClick }: FooterActionProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-all duration-150"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--aurora-surface-hover)" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
    >
      <span className="opacity-60">{icon}</span>
      <span className="font-medium tracking-tight">{label}</span>
    </button>
  )
}

interface TagSidebarItemProps {
  name: string
  count: number
  onClick: () => void
}

function TagSidebarItem({ name, count, onClick }: TagSidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full flex items-center gap-2 px-3 py-[6px] rounded-md text-left text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-all duration-150"
    >
      <span
        className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ background: "var(--aurora-surface-hover)" }}
        aria-hidden="true"
      />
      <span
        className="relative z-10 w-[4px] h-[4px] rounded-full flex-shrink-0"
        style={{
          background: "var(--aurora-muted)",
        }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex-1 min-w-0 truncate text-[12.5px] font-medium tracking-tight">
        {name}
      </span>
      <span className="relative z-10 text-[10px] tabular-nums text-[var(--aurora-text-tertiary)] group-hover:text-[var(--aurora-text-secondary)] transition-colors duration-150">
        {count}
      </span>
    </button>
  )
}
