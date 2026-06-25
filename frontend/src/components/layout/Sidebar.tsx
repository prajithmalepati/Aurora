type View =
  | { kind: "all-songs" }
  | { kind: "recently-added" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }
  | { kind: "albums" }
  | { kind: "folders" }
  | { kind: "settings" }
  | { kind: "about" }
import { motion } from "motion/react"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { useFilterStore } from "@/stores/filterStore"
import { useUpdateStore } from "@/stores/updateStore"
import { PlaylistItem } from "@/components/playlists/PlaylistItem"
import { BorderGlow } from "@/components/ui/BorderGlow"
import { CreatePlaylistDialog } from "@/components/playlists/CreatePlaylistDialog"

import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { Library, SlidersHorizontal, Plus, Settings, FolderOpen, Info, Disc3, Clock } from "lucide-react"
import { AuroraWordmark } from "@/components/aurora/AuroraWordmark"

function hexToGlowHSL(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '185 60 60'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)} ${Math.round(l * 100)}`
}

function playlistGlowColors(color: string | null | undefined): [string, string, string] {
  const base = color || '#38bdf8'
  return [base, base, base]
}

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const playlists = usePlaylistStore((state) => state.playlists)
  const playlistsLoading = usePlaylistStore((state) => state.loading)
  const playlistsError = usePlaylistStore((state) => state.error)
  const tags = useTagStore((state) => state.tags)
  const tagsLoading = useTagStore((state) => state.loading)
  const tagsError = useTagStore((state) => state.error)
  const setQuery = useFilterStore((state) => state.setQuery)
  const setIsQuickTagView = useFilterStore((state) => state.setIsQuickTagView)
  const isQuickTagView = useFilterStore((state) => state.isQuickTagView)
  const filterQuery = useFilterStore((state) => state.query)
  const updateStatus = useUpdateStore((state) => state.status)
  const showUpdateDot = updateStatus === "available" || updateStatus === "downloading" || updateStatus === "installed"

  const handleTagClick = (tagName: string) => {
    const term = `"${tagName}"`
    setQuery(term)
    setIsQuickTagView(true)
    // Don't call executeFilter() here — QueryBuilder's debounced useEffect
    // watches `query` and fires executeFilter after 280ms. Calling it here
    // AND in the effect causes a double-refresh.
    onViewChange({ kind: "filter" })
  }

  const isActive = (view: View) => {
    if (view.kind === "playlist" && currentView.kind === "playlist") {
      return currentView.playlistId === view.playlistId
    }
    return currentView.kind === view.kind
  }

  return (
    <>
      <aside className="w-60 h-full flex flex-col bg-[var(--aurora-obsidian)]/95">
        {/* Brand lockup */}
        <div className="px-6 pt-7 pb-5">
          <button
            onClick={() => onViewChange({ kind: "all-songs" })}
            className="select-none hover:opacity-80 transition-opacity duration-150 aurora-wordmark-reveal"
          >
            <AuroraWordmark />
          </button>
          {/* Thin aurora gradient line beneath logo — animated shimmer */}
          <div
            className="mt-3 h-[1px] w-12 aurora-underline-shimmer"
            style={{
              background: "linear-gradient(to right, var(--aurora-accent-interactive), var(--aurora-violet), var(--aurora-accent-interactive))",
              opacity: 0.4,
            }}
          />
        </div>

        {/* Primary nav */}
        <nav className="px-3 space-y-0.5">
          <NavItem
            icon={<Library className="h-4 w-4" strokeWidth={1.5} />}
            label="All Songs"
            active={isActive({ kind: "all-songs" })}
            onClick={() => onViewChange({ kind: "all-songs" })}
          />
          <NavItem
            icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
            label="Recently Added"
            active={isActive({ kind: "recently-added" })}
            onClick={() => onViewChange({ kind: "recently-added" })}
          />
          <NavItem
            icon={<SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />}
            label="Mix"
            active={isActive({ kind: "filter" }) && !isQuickTagView}
            onClick={() => {
              setIsQuickTagView(false)
              onViewChange({ kind: "filter" })
            }}
          />
          <NavItem
            icon={<FolderOpen className="h-4 w-4" strokeWidth={1.5} />}
            label="Folders"
            active={isActive({ kind: "folders" })}
            onClick={() => onViewChange({ kind: "folders" })}
          />
          <NavItem
            icon={<Disc3 className="h-4 w-4" strokeWidth={1.5} />}
            label="Albums"
            active={isActive({ kind: "albums" })}
            onClick={() => onViewChange({ kind: "albums" })}
          />
        </nav>

        {/* Divider */}
        <div className="aurora-divider-h mx-6 my-5" />

        {/* Scrollable middle: Playlists + Tags */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Playlists section header */}
          <div className="px-6 mb-2 flex items-center justify-between group">
            <span className="label-micro">Playlists</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 h-5 w-5 rounded flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.06]"
                aria-label="New playlist"
              >
                <Plus className="h-3 w-3" />
              </button>
              <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
                {playlists.length}
              </span>
            </div>
          </div>

          <div className="px-3 pb-1">
            {playlistsLoading ? (
              <div className="space-y-1 px-1 py-1">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ) : playlistsError ? (
              <div className="px-3 py-3 text-center">
                <p className="text-[11px] text-[var(--aurora-danger)]">
                  Failed to load playlists
                </p>
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
                  <BorderGlow
                    key={playlist.id}
                    className="border-glow-pl"
                    glowColor={hexToGlowHSL(playlist.color)}
                    colors={playlistGlowColors(playlist.color)}
                    borderRadius={6}
                    glowRadius={6}
                    glowIntensity={0.7}
                    edgeSensitivity={30}
                    coneSpread={18}
                    backgroundColor="transparent"
                    disableShadow
                    animated={false}
                  >
                    <PlaylistItem
                      playlist={playlist}
                      isActive={isActive({ kind: "playlist", playlistId: playlist.id })}
                      onSelect={(playlistId) => onViewChange({ kind: "playlist", playlistId })}
                    />
                  </BorderGlow>
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
            ) : tagsError ? (
              <div className="px-3 py-3 text-center">
                <p className="text-[11px] text-[var(--aurora-danger)]">
                  Failed to load tags
                </p>
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
                    active={isQuickTagView && currentView.kind === "filter" && filterQuery === `"${tag.name}"`}
                    onClick={() => handleTagClick(tag.name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-3 pb-4 pt-2 space-y-0.5 shrink-0">
          <div className="aurora-divider-h mx-3 mb-3" />
          <FooterAction
            icon={<Settings className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="Settings"
            active={currentView.kind === "settings"}
            onClick={() => onViewChange({ kind: "settings" })}
            suffix={
              showUpdateDot ? (
                <span
                  className="aurora-update-dot w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--aurora-accent-interactive), var(--aurora-secondary))",
                    boxShadow: "0 0 6px 1px var(--aurora-accent-interactive-glow)",
                  }}
                  aria-label="Update available"
                  title="Update available"
                />
              ) : undefined
            }
          />
          <FooterAction
            icon={<Info className="h-3.5 w-3.5" strokeWidth={1.5} />}
            label="About"
            active={currentView.kind === "about"}
            onClick={() => onViewChange({ kind: "about" })}
          />
        </div>
      </aside>

      <CreatePlaylistDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

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
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-200 aurora-focus active:bg-white/[0.03] ${
        active
          ? "text-[var(--aurora-text)] bg-white/[0.05]"
          : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active background — layoutId slides indicator between nav items */}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{ background: "var(--aurora-surface)" }}
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
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
        <span className={active ? "text-[var(--aurora-accent-interactive)]" : ""}>{icon}</span>
        <span className="font-medium tracking-tight">{label}</span>
      </span>
    </button>
  )
}

interface FooterActionProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
  suffix?: React.ReactNode
}

function FooterAction({ icon, label, active, onClick, suffix }: FooterActionProps) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] transition-colors duration-150 ${
        active
          ? "text-[var(--aurora-accent-interactive)] bg-[var(--aurora-accent-interactive)]/10"
          : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] group-hover:bg-white/[0.05]"
      }`}
    >
      <span className={active ? "" : "opacity-60"}>{icon}</span>
      <span className="font-medium tracking-tight">{label}</span>
      {suffix && <span className="ml-auto">{suffix}</span>}
    </button>
  )
}

interface TagSidebarItemProps {
  name: string
  count: number
  active?: boolean
  onClick: () => void
}

function TagSidebarItem({ name, count, active, onClick }: TagSidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-2 px-3 py-[6px] rounded-md text-left transition-colors duration-150 active:bg-white/[0.03] ${
        active
          ? "text-[var(--aurora-text)] bg-white/[0.05]"
          : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
      }`}
    >
      {/* Active indicator — matches NavItem's layoutId pattern */}
      {active && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          style={{ background: "var(--aurora-surface)" }}
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute inset-0 rounded-md transition-opacity duration-150 pointer-events-none ${
          active ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ background: "var(--aurora-surface-hover)" }}
        aria-hidden="true"
      />
      <span
        className="relative z-10 w-[4px] h-[4px] rounded-full flex-shrink-0"
        style={{
          background: active ? "var(--aurora-accent-interactive)" : "var(--aurora-muted)",
        }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex-1 min-w-0 truncate text-[13px] font-medium tracking-tight">
        {name}
      </span>
      <span className="relative z-10 text-[10px] tabular-nums text-[var(--aurora-text-tertiary)] group-hover:text-[var(--aurora-text-secondary)] transition-colors duration-150">
        {count}
      </span>
    </button>
  )
}
