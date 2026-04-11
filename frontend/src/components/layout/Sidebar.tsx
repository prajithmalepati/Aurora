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
import { Library, SlidersHorizontal, Plus, FolderSearch, Music, Tag as TagIcon } from "lucide-react"
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
    // Execute on next tick so the view has switched first
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
        <div className="px-6 pt-7 pb-6">
          <button
            onClick={() => onViewChange({ kind: "all-songs" })}
            className="font-display text-[34px] leading-none tracking-tight aurora-gradient-text select-none hover:opacity-80 transition-opacity duration-150"
          >
            Aurora
          </button>
          <p className="label-micro mt-1.5">Your Library</p>
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
            <span className="text-[10px] text-[var(--aurora-text-muted)] tabular-nums">
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
                <p className="text-xs text-[var(--aurora-text-muted)] font-display-italic text-[13px]">
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
            <span className="label-micro inline-flex items-center gap-1.5">
              <TagIcon className="h-[10px] w-[10px]" strokeWidth={2.5} />
              Tags
            </span>
            <span className="text-[10px] text-[var(--aurora-text-muted)] tabular-nums">
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
                <p className="text-xs text-[var(--aurora-text-muted)] font-display-italic text-[13px]">
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
        <div className="px-3 pb-4 pt-2 space-y-1">
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
          : "text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active indicator — 2px left bar with aurora gradient */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r-full transition-all duration-300 ${
          active ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(to bottom, #5eead4, #86efac, #a78bfa)",
          boxShadow: active ? "0 0 10px rgba(94, 234, 212, 0.5), 0 0 10px rgba(167, 139, 250, 0.3)" : "none",
        }}
        aria-hidden="true"
      />
      {/* Active background — aurora gradient halo */}
      {active && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at left, rgba(94,234,212,0.06) 0%, rgba(134,239,172,0.03) 40%, rgba(167,139,250,0.04) 80%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      )}
      {/* Hover background */}
      <span
        className={`absolute inset-0 rounded-md bg-white/[0.02] transition-opacity duration-200 pointer-events-none ${
          active ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}
        aria-hidden="true"
      />
      <span className="relative z-10 flex items-center gap-3">
        <span className={active ? "text-[var(--aurora-mint)]" : ""}>{icon}</span>
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
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] hover:bg-white/[0.025] transition-all duration-150"
    >
      <span className="opacity-70">{icon}</span>
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
      className="group relative w-full flex items-center gap-2 px-3 py-[6px] rounded-md text-left text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] transition-all duration-150"
    >
      <span
        className="absolute inset-0 rounded-md bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        aria-hidden="true"
      />
      <span
        className="relative z-10 w-[4px] h-[4px] rounded-full flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #5eead4, #a78bfa)",
          boxShadow: "0 0 6px rgba(94, 234, 212, 0.5)",
        }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex-1 min-w-0 truncate text-[12.5px] font-medium tracking-tight">
        {name}
      </span>
      <span className="relative z-10 text-[10px] tabular-nums text-[var(--aurora-text-muted)] group-hover:text-[var(--aurora-text-dim)] transition-colors duration-150">
        {count}
      </span>
    </button>
  )
}
