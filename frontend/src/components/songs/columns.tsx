import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { AuroraPlayButton } from "@/components/player/AuroraPlayButton"
import { TagList } from "@/components/tags/TagList"
import { MoreHorizontal, ListPlus, Pencil, Tag as TagIcon, Scissors, X, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { SortField } from "./SongTable"

// ── Column ID type ──
export type ColumnId = "index" | "title" | "type" | "duration" | "artist" | "album" | "tags" | "actions"

// ── Cell context — everything a cell render function needs ──
export interface CellCtx {
  isCurrentSong: boolean
  isCurrentlyPlaying: boolean
  isSelected: boolean
  index: number
  hasFile: boolean
  selectMode: boolean
  inQueue: boolean
  // Callbacks
  onPlay: (e?: React.MouseEvent) => void
  onToggleSelect: (shiftKey: boolean, metaKey?: boolean) => void
  onDelete: () => void
  onAddToQueue: (e: React.MouseEvent) => void
  onEditTags: () => void
  onEditSong: () => void
  onPlayNext?: () => void
  onAddToPlaylist?: () => void
  onTrim?: () => void
  onRemoveFromPlaylist?: () => void
}

// ── Column definition ──
export interface ColumnDef {
  id: ColumnId
  label: string
  fixed?: boolean
  sortable?: SortField
  defaultWidth?: number
  minWidth?: number
  headerClassName?: string
  cellClassName?: string
  render: (song: Song, ctx: CellCtx) => React.ReactNode
}

// ── Column registry ──
export const COLUMN_REGISTRY: ColumnDef[] = [
  {
    id: "index",
    label: "#",
    fixed: true,
    defaultWidth: 48,
    minWidth: 40,
    headerClassName: "w-12 text-center",
    cellClassName: "px-4 py-2 w-12 text-center",
    render: (song, ctx) => (
      <>
        <span className="relative z-10 flex items-center justify-center">
          {ctx.isCurrentSong ? (
            <Equalizer playing={ctx.isCurrentlyPlaying} />
          ) : (
            <span className="text-xs tabular-nums transition-opacity duration-150 group-hover:opacity-0 select-none">
              {ctx.index + 1}
            </span>
          )}
        </span>
        {!ctx.isCurrentSong && (
          <span className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <AuroraPlayButton
              variant="row"
              isPlaying={false}
              onClick={(e) => { e.stopPropagation(); ctx.onPlay() }}
              ariaLabel={`Play ${song.title}`}
            />
          </span>
        )}
      </>
    ),
  },
  {
    id: "title",
    label: "Title",
    fixed: true,
    sortable: "title",
    defaultWidth: 300,
    minWidth: 200,
    cellClassName: "px-4 py-2",
    render: (song, ctx) => (
      <>
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <AlbumArt song={song} size="sm" className="aurora-rim" />
          <div className="flex flex-col min-w-0">
            <span
              className={`truncate text-[14px] font-medium leading-tight ${
                ctx.isCurrentSong ? "text-white/90" : "text-[var(--aurora-text)]"
              }`}
            >
              {song.title || "Untitled"}
            </span>
            <span className="truncate text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              {song.artist || "Unknown Artist"}
              {song.featured_artists && song.featured_artists.length > 0 && (
                <span className="text-[var(--aurora-text-tertiary)]">
                  {" "}feat. {song.featured_artists.join(", ")}
                </span>
              )}
            </span>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "type",
    label: "Type",
    defaultWidth: 64,
    minWidth: 48,
    headerClassName: "hidden lg:table-cell",
    cellClassName: "relative px-4 py-2 text-[12px] hidden lg:table-cell",
    render: (song, _ctx) => (
      <>
        <span className="relative z-10">
          {song.file_format ? (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
              style={{
                background: "var(--aurora-surface-inset)",
                color: "var(--aurora-text-secondary)",
                border: "1px solid var(--aurora-rim)",
              }}
            >
              {song.file_format}
            </span>
          ) : (
            <span className="text-[var(--aurora-text-tertiary)]">—</span>
          )}
        </span>
      </>
    ),
  },
  {
    id: "duration",
    label: "Duration",
    sortable: "duration",
    defaultWidth: 80,
    minWidth: 64,
    headerClassName: "w-20 hidden lg:table-cell",
    cellClassName: "relative px-4 py-2 w-20 text-[12px] text-[var(--aurora-text-secondary)] tabular-nums hidden lg:table-cell",
    render: (_song, _ctx) => (
      <>
        <span className="relative z-10 tabular-nums whitespace-nowrap">
          {formatDuration(_song.duration)}
        </span>
      </>
    ),
  },
  {
    id: "artist",
    label: "Artist",
    sortable: "artist",
    defaultWidth: 160,
    minWidth: 100,
    headerClassName: "hidden lg:table-cell",
    cellClassName: "relative px-4 py-2 text-[13px] hidden lg:table-cell",
    render: (song, _ctx) => (
      <>
        <span className="relative z-10 truncate text-[var(--aurora-text-secondary)]">
          {song.artist || "Unknown Artist"}
        </span>
      </>
    ),
  },
  {
    id: "album",
    label: "Album",
    sortable: "album",
    defaultWidth: 160,
    minWidth: 100,
    headerClassName: "hidden lg:table-cell",
    cellClassName: "relative px-4 py-2 text-[13px] hidden lg:table-cell",
    render: (song, _ctx) => (
      <>
        <span className="relative z-10 truncate text-[var(--aurora-text-secondary)]">
          {song.album || "—"}
        </span>
      </>
    ),
  },
  {
    id: "tags",
    label: "Tags",
    defaultWidth: 200,
    minWidth: 100,
    headerClassName: "max-w-[200px]",
    cellClassName: "relative px-4 py-2 max-w-[200px]",
    render: (song, _ctx) => (
      <>
        <div className="relative z-10">
          <TagList tags={song.tags} />
        </div>
      </>
    ),
  },
  {
    id: "actions",
    label: "Actions",
    fixed: true,
    defaultWidth: 128,
    minWidth: 96,
    headerClassName: "w-32 text-right",
    cellClassName: "relative px-4 py-2 w-12",
    render: (_song, ctx) => (
      <>
        <div className="relative z-10 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="aurora-focus h-7 w-7 rounded-md flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-colors duration-150"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem onClick={ctx.onPlay}>
                <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-accent)]">▶</span>
                Play Now
              </DropdownMenuItem>
              {ctx.onPlayNext && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onPlayNext!() }}>
                  <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-text-secondary)]">↳</span>
                  Play Next
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onAddToQueue(e as unknown as React.MouseEvent) }}>
                <ListPlus className="h-4 w-4" />
                {ctx.inQueue ? "Already in Queue" : "Add to Queue"}
              </DropdownMenuItem>
              {ctx.onAddToPlaylist && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onAddToPlaylist!() }}>
                  <ListPlus className="h-4 w-4" />
                  Add to Playlist
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onEditTags() }}>
                <TagIcon className="h-4 w-4" />
                Edit Tags
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onEditSong() }}>
                <Pencil className="h-4 w-4" />
                Edit Song
              </DropdownMenuItem>
              {ctx.onTrim && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); ctx.onTrim!() }}>
                  <Scissors className="h-4 w-4" />
                  Trim
                </DropdownMenuItem>
              )}
              {ctx.onRemoveFromPlaylist && (
                <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); ctx.onRemoveFromPlaylist!() }}>
                  <X className="h-4 w-4" />
                  Remove from Playlist
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); ctx.onDelete() }}>
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>
    ),
  },
]

// ── Helpers ──

const COLUMN_MAP = new Map(COLUMN_REGISTRY.map((c) => [c.id, c]))

/** Get column definition by ID. Throws if not found. */
export function getColumn(id: ColumnId): ColumnDef {
  const col = COLUMN_MAP.get(id)
  if (!col) throw new Error(`Unknown column: ${id}`)
  return col
}

/** All column IDs in registry order. */
export const ALL_COLUMN_IDS: ColumnId[] = COLUMN_REGISTRY.map((c) => c.id)

/** Fixed column IDs (cannot hide or reorder). */
export const FIXED_COLUMN_IDS: ColumnId[] = COLUMN_REGISTRY.filter((c) => c.fixed).map((c) => c.id)

/** Toggleable column IDs (can hide/reorder). */
export const TOGGLEABLE_COLUMN_IDS: ColumnId[] = COLUMN_REGISTRY.filter((c) => !c.fixed).map((c) => c.id)

/** Default column order (all columns, registry order). */
export const DEFAULT_ORDER: ColumnId[] = [...ALL_COLUMN_IDS]

/** Default hidden columns (none — all visible by default). */
export const DEFAULT_HIDDEN: ColumnId[] = []
