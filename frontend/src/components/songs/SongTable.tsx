import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useSongStore } from "@/stores/songStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { useColumnStore, type ColumnContext } from "@/stores/columnStore"
import type { Song } from "@/types"
import { SongRow } from "./SongRow"
import { getColumn, type ColumnId, type ColumnDef, DEFAULT_ORDER } from "./columns"

import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/lib/toast"
import { api } from "@/lib/api"
import { EditSongDialog } from "@/components/songs/EditSongDialog"
import { TagEditor } from "@/components/tags/TagEditor"
import { ColumnPicker } from "./ColumnPicker"
import { Music, ChevronUp, ChevronDown, AlertTriangle, RefreshCw, ListPlus, Tag as TagIcon, X, Trash2, Pencil, Scissors } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

interface SongTableProps {
  songs: Song[]
  loading?: boolean
  error?: string | null
  onPlay?: (song: Song, index: number) => void
  animKey?: number
  showSort?: boolean
  columnContext?: ColumnContext
  /** When true, songs are the complete set (no pagination). Disables "Load more" and shows songs.length as total. */
  disableInfiniteScroll?: boolean
  // Playlist-mode optional props (passed through to SongRow)
  onRemoveFromPlaylist?: (song: Song) => void
  onTrim?: (songId: number) => void
  fillHeight?: boolean
  /** Optional empty-state override (e.g. search-aware message). Falls back to default. */
  emptyTitle?: string
  emptyHint?: string
  // Drag-and-drop (dnd-kit)
  isDraggable?: boolean
  onReorder?: (fromId: number, toId: number) => void
}

const HEADER_CLASS =
  "px-4 py-2 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] font-medium"

export type SortField = "title" | "artist" | "album" | "duration" | "created_at" | "file_format"

// ── Checkbox (matches PlaylistDetail pattern) ──

interface CheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  ariaLabel: string
}

function Checkbox({ checked, indeterminate, onChange, ariaLabel }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className="h-4 w-4 rounded-[3px] flex items-center justify-center transition-[color,background-color,border-color,box-shadow] duration-150 aurora-focus"
      style={{
        background: checked || indeterminate ? "var(--aurora-accent-interactive)" : "transparent",
        border: checked || indeterminate ? "1.5px solid var(--aurora-accent-interactive)" : "1.5px solid var(--aurora-text-tertiary)",
      }}
    >
      {checked && !indeterminate && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-black">
          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none" className="text-black">
          <path d="M0 1H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}

// ── TableHeader ──

interface TableHeaderProps {
  visibleColumns: ColumnDef[]
  sortField: SortField
  sortOrder: "asc" | "desc"
  onSort: (field: SortField) => void
  showCheckbox: boolean
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectAll: () => void
  isDraggable?: boolean
  onResize?: (id: ColumnId, width: number) => void
  columnWidths?: Partial<Record<ColumnId, number>>
}

function TableHeader({ visibleColumns, sortField, sortOrder, onSort, showCheckbox, isAllSelected, isIndeterminate, onSelectAll, isDraggable, onResize, columnWidths }: TableHeaderProps) {
  const SortArrow = sortOrder === "asc" ? ChevronUp : ChevronDown

  // Resize state
  const resizingRef = useRef<{ id: ColumnId; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = useCallback((e: React.MouseEvent, col: ColumnDef) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = columnWidths?.[col.id] ?? col.defaultWidth ?? 100
    resizingRef.current = { id: col.id, startX: e.clientX, startWidth }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const delta = ev.clientX - resizingRef.current.startX
      const newWidth = Math.max(resizingRef.current.startWidth + delta, col.minWidth ?? 48)
      onResize?.(resizingRef.current.id, newWidth)
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [columnWidths, onResize])

  return (
    <thead>
      <tr>
        {isDraggable && (
          <th className="px-1 py-2 w-6" />
        )}
        {showCheckbox && (
          <th className="px-2 py-2 w-10 text-center">
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={onSelectAll}
              ariaLabel="Select all songs"
            />
          </th>
        )}
        {visibleColumns.map((col) => {
          const active = col.sortable && sortField === col.sortable
          const isSortable = !!col.sortable
          const isResizable = !!onResize && !col.fixed
          return (
            <th
              key={col.id}
              className={`${HEADER_CLASS} ${isSortable ? "cursor-pointer select-none hover:text-[var(--aurora-text-secondary)]" : ""} ${active ? "text-[var(--aurora-text-secondary)]" : ""} ${col.headerClassName ?? ""} relative group/th`}
              onClick={isSortable ? () => onSort(col.sortable!) : undefined}
            >
              {isSortable ? (
                <span className="inline-flex items-center gap-0.5">
                  {col.label}
                  {active && <SortArrow className="h-2.5 w-2.5" />}
                </span>
              ) : (
                col.label
              )}
              {/* Resize handle */}
              {isResizable && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize opacity-0 pointer-events-none group-hover/th:opacity-60 group-hover/th:pointer-events-auto hover:!opacity-100 transition-opacity z-10"
                  style={{ background: "var(--aurora-accent-interactive)" }}
                  onMouseDown={(e) => handleResizeStart(e, col)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

// ── BulkTagDialog ──

interface BulkTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songIds: number[]
  onComplete: () => void
}

function BulkTagDialog({ open, onOpenChange, songIds, onComplete }: BulkTagDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const allTags = useTagStore((s) => s.tags)
  const fetchTags = useTagStore((s) => s.fetchTags)

  useEffect(() => {
    if (open) {
      fetchTags()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, fetchTags])

  const filteredTags = allTags.filter(
    (t) => !inputValue || t.name.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleAddTag = async (name: string) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    try {
      await Promise.all(songIds.map(id => api.post(`/songs/${id}/tags`, { tag_names: [trimmed] })))
      await fetchTags()
      await useSongStore.getState().fetchSongs()
      setInputValue("")
      toast.success(`Tag "${trimmed}" added to ${songIds.length} song${songIds.length === 1 ? "" : "s"}`)
      onComplete()
    } catch {
      toast.error("Failed to add tag")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] leading-tight">
            Tag selected songs
          </DialogTitle>
          <p className="text-[12px] text-[var(--aurora-text-secondary)] font-display-italic mt-0.5">
            {songIds.length} song{songIds.length === 1 ? "" : "s"} selected
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <p className="label-micro text-[9.5px] mb-2.5">Add tag</p>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  handleAddTag(inputValue)
                }
              }}
              placeholder="Type and press Enter..."
            />
          </div>

          {filteredTags.length > 0 && (
            <div
              className="max-h-[180px] overflow-y-auto rounded-md"
              style={{
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
                background: "var(--aurora-surface-inset)",
              }}
            >
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAddTag(tag.name)}
                  className="w-full px-3 py-2 text-[13px] text-[var(--aurora-text)] cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between"
                >
                  <span>{tag.name}</span>
                  <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
                    {tag.song_count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── AddToPlaylistDialog ──

interface AddToPlaylistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songIds: number[]
  onComplete: () => void
}

function AddToPlaylistDialog({ open, onOpenChange, songIds, onComplete }: AddToPlaylistDialogProps) {
  const [searchValue, setSearchValue] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const playlists = usePlaylistStore((s) => s.playlists)
  const fetchPlaylists = usePlaylistStore((s) => s.fetchPlaylists)
  const addSongToPlaylist = usePlaylistStore((s) => s.addSongToPlaylist)

  useEffect(() => {
    if (open) {
      fetchPlaylists()
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [open, fetchPlaylists])

  const filtered = playlists.filter(
    (p) => !searchValue || p.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleAdd = async (playlistId: number, playlistName: string) => {
    try {
      for (const songId of songIds) {
        await addSongToPlaylist(playlistId, songId)
      }
      toast.success(`${songIds.length} song${songIds.length === 1 ? "" : "s"} added to "${playlistName}"`)
      onOpenChange(false)
      onComplete()
    } catch {
      toast.error("Failed to add songs to playlist")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] leading-tight">
            Add to playlist
          </DialogTitle>
          <p className="text-[12px] text-[var(--aurora-text-secondary)] font-display-italic mt-0.5">
            {songIds.length} song{songIds.length === 1 ? "" : "s"} selected
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Input
              ref={searchRef}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search playlists..."
            />
          </div>

          {filtered.length > 0 ? (
            <div
              className="max-h-[240px] overflow-y-auto rounded-md"
              style={{
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
                background: "var(--aurora-surface-inset)",
              }}
            >
              {filtered.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => handleAdd(playlist.id, playlist.name)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--aurora-text)] cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 flex items-center gap-2.5"
                >
                  <span
                    className="w-[6px] h-[6px] rounded-sm flex-shrink-0"
                    style={{ backgroundColor: "var(--aurora-accent-vivid)" }}
                  />
                  <span className="flex-1 text-left truncate">{playlist.name}</span>
                  <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
                    {playlist.song_count} song{playlist.song_count === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--aurora-text-tertiary)] font-display-italic text-center py-4">
              No playlists found
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── SortDropdown ──
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "artist-asc", label: "Artist A–Z" },
  { value: "artist-desc", label: "Artist Z–A" },
  { value: "album-asc", label: "Album A–Z" },
  { value: "album-desc", label: "Album Z–A" },
  { value: "duration-asc", label: "Duration ↑" },
  { value: "duration-desc", label: "Duration ↓" },
  { value: "created_at-desc", label: "Newest first" },
  { value: "created_at-asc", label: "Oldest first" },
  { value: "file_format-asc", label: "Type A–Z" },
  { value: "file_format-desc", label: "Type Z–A" },
]

function SortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const currentLabel = SORT_OPTIONS.find((o) => o.value === value)?.label ?? value

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
          open
            ? "text-[var(--aurora-accent-interactive)] bg-[var(--aurora-accent-interactive)]/10"
            : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] hover:bg-white/[0.04]"
        }`}
      >
        {currentLabel}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1.5 rounded-lg shadow-xl border"
          style={{
            background: "var(--aurora-surface-2)",
            borderColor: "var(--aurora-rim)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-[11px] rounded-sm transition-colors duration-100 ${
                value === opt.value
                  ? "text-[var(--aurora-accent-interactive)] bg-[var(--aurora-accent-interactive)]/10"
                  : "text-[var(--aurora-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--aurora-text)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SongTable ──

const ROW_HEIGHT = 52
const OVERSCAN = 10

export function SongTable({
  songs, loading = false, error = null, onPlay, animKey, showSort = true, columnContext: _columnContext, disableInfiniteScroll = false,
  onRemoveFromPlaylist, onTrim, fillHeight = false,
  emptyTitle = "Nothing here yet",
  emptyHint = "Scan a folder or add a song to begin.",
  isDraggable, onReorder,
}: SongTableProps) {
  const sortField = useSongStore((state) => state.sortField)
  const sortOrder = useSongStore((state) => state.sortOrder)
  const sortSongs = useSongStore((state) => state.sortSongs)
  const storeTotalCount = useSongStore((state) => state.totalCount)
  const storeHasMore = useSongStore((state) => state.hasMore)
  const fetchMore = useSongStore((state) => state.fetchMore)
  const totalCount = disableInfiniteScroll ? songs.length : storeTotalCount
  const hasMore = disableInfiniteScroll ? false : storeHasMore

  const playSong = usePlayerStore((s) => s.playSong)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const deleteSong = useSongStore((s) => s.deleteSong)
  const allTags = useTagStore((s) => s.tags)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)
  const [selectMode, setSelectMode] = useState(false)

  // dnd-kit sensors (for playlist drag reorder)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Column state from persistent store (or defaults if no context)
  const columnContext = _columnContext ?? "all-songs"
  const columnConfig = useColumnStore((s) => s.getConfig(columnContext))
  const setColumnWidth = useColumnStore((s) => s.setWidth)

  const handleResize = useCallback((id: ColumnId, width: number) => {
    setColumnWidth(columnContext, id, width)
  }, [columnContext, setColumnWidth])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    onReorder(active.id as number, over.id as number)
  }, [onReorder])

  // Compute visible columns from store config
  const visibleColumns = useMemo(() => {
    const order = columnConfig.order.length > 0 ? columnConfig.order : DEFAULT_ORDER
    const hidden = new Set(columnConfig.hidden)
    return order
      .filter((id) => !hidden.has(id))
      .map((id) => getColumn(id))
  }, [columnConfig])

  // Compute colspan from visible columns + drag + checkbox
  const tableColspan = visibleColumns.length + (isDraggable ? 1 : 0) + (selectMode ? 1 : 0)

  // Context menu state (lifted from SongRow — selection-aware)
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; song: Song; songIndex: number
  } | null>(null)
  const [contextTagSearch, setContextTagSearch] = useState("")

  // Bulk dialog state
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [addToPlaylistDialogOpen, setAddToPlaylistDialogOpen] = useState(false)
  // Single-song edit dialog state (for right-click Edit Song / Edit Tags)
  const [contextEditSong, setContextEditSong] = useState<Song | null>(null)
  const [contextTagSong, setContextTagSong] = useState<Song | null>(null)

  // Only clear selection when songs are replaced (first ID changes), not when appended
  const firstIdRef = useRef<number | null>(songs[0]?.id ?? null)
  useEffect(() => {
    const newFirstId = songs[0]?.id ?? null
    if (newFirstId !== firstIdRef.current) {
      setSelectedIds(new Set())
      lastSelectedIndexRef.current = null
      setSelectMode(false)
    }
    firstIdRef.current = newFirstId
  }, [songs])

  // Esc exits select mode
  useEffect(() => {
    if (!selectMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectMode(false)
        setSelectedIds(new Set())
        lastSelectedIndexRef.current = null
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectMode])

  const isAllSelected = songs.length > 0 && songs.every((s) => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(songs.map((s) => s.id)))
    }
    lastSelectedIndexRef.current = null
  }

  const toggleSelectOne = useCallback((songId: number, shiftKey: boolean, metaKey?: boolean) => {
    // Auto-enter select mode on ctrl/cmd-click so selection is visible
    if (!selectMode && metaKey) {
      setSelectMode(true)
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (shiftKey && lastSelectedIndexRef.current !== null) {
        const currIndex = songs.findIndex((s) => s.id === songId)
        const lastIndex = lastSelectedIndexRef.current
        if (currIndex !== -1 && lastIndex !== -1) {
          const [from, to] = lastIndex < currIndex ? [lastIndex, currIndex] : [currIndex, lastIndex]
          for (let i = from; i <= to; i++) {
            next.add(songs[i].id)
          }
        } else {
          if (next.has(songId)) next.delete(songId)
          else next.add(songId)
        }
      } else {
        if (next.has(songId)) next.delete(songId)
        else next.add(songId)
      }
      return next
    })
    const index = songs.findIndex((s) => s.id === songId)
    lastSelectedIndexRef.current = index
  }, [songs, selectMode])

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  // Determine if right-clicked song is part of the current selection
  const contextTargets = useMemo((): Song[] => {
    if (!contextMenu) return []
    // If the right-clicked song is in a multi-selection, act on all selected
    if (selectedIds.size > 1 && selectedIds.has(contextMenu.song.id)) {
      return songs.filter((s) => selectedIds.has(s.id))
    }
    // Otherwise act on the single clicked song only
    return [contextMenu.song]
  }, [contextMenu, selectedIds, songs])

  const handleContextMenuEvent = useCallback((e: React.MouseEvent, song: Song, songIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - 300)
    setContextMenu({ x, y, song, songIndex })
    setContextTagSearch("")
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setContextTagSearch("")
  }, [])

  // Context menu actions (operate on contextTargets)
  const ctxPlayNow = useCallback(() => {
    const targets = contextTargets.filter((s) => s.file_path)
    if (targets.length === 0) { toast.error("No playable files"); return }
    playSong(targets[0], targets.length > 1 ? targets : songs)
    closeContextMenu()
  }, [contextTargets, songs, playSong, closeContextMenu])

  const ctxPlayNext = useCallback(() => {
    const targets = contextTargets.filter((s) => s.file_path)
    if (targets.length === 0) { toast.error("No playable files"); return }
    // Insert in reverse so the first selected song ends up first in queue
    for (const s of [...targets].reverse()) usePlayerStore.getState().playNext(s)
    toast.success(`${targets.length === 1 ? `"${targets[0].title}" will play next` : `${targets.length} songs queued next`}`)
    closeContextMenu()
  }, [contextTargets, closeContextMenu])

  const ctxAddToQueue = useCallback(() => {
    const targets = contextTargets.filter((s) => s.file_path)
    if (targets.length === 0) { toast.error("No playable files"); return }
    for (const s of targets) addToQueue(s)
    toast.success(`${targets.length} song${targets.length === 1 ? "" : "s"} added to queue`)
    closeContextMenu()
  }, [contextTargets, addToQueue, closeContextMenu])

  const ctxDelete = useCallback(async () => {
    const targets = [...contextTargets]
    closeContextMenu()
    for (const s of targets) {
      try { await deleteSong(s.id) } catch { toast.error(`Failed to delete "${s.title}"`) }
    }
    if (targets.length > 0) toast.success(`${targets.length} song${targets.length === 1 ? "" : "s"} deleted`)
    setSelectedIds(new Set())
    lastSelectedIndexRef.current = null
  }, [contextTargets, closeContextMenu, deleteSong])

  const ctxAddTag = useCallback(async (tagName: string) => {
    const trimmed = tagName.trim().toLowerCase()
    if (!trimmed) return
    const ids = contextTargets.map((s) => s.id)
    try {
      await Promise.all(ids.map((id) => api.post(`/songs/${id}/tags`, { tag_names: [trimmed] })))
      await useTagStore.getState().fetchTags()
      await useSongStore.getState().fetchSongs()
      toast.success(`Tag "${trimmed}" added to ${ids.length} song${ids.length === 1 ? "" : "s"}`)
    } catch {
      toast.error("Failed to add tag")
    }
    closeContextMenu()
  }, [contextTargets, closeContextMenu])

  const ctxRemoveFromPlaylist = useCallback(async () => {
    if (!onRemoveFromPlaylist) return
    const targets = [...contextTargets]
    closeContextMenu()
    for (const s of targets) onRemoveFromPlaylist(s)
  }, [contextTargets, onRemoveFromPlaylist, closeContextMenu])

  function handleColumnSort(field: SortField) {
    if (field === sortField) {
      sortSongs(field, sortOrder === "asc" ? "desc" : "asc")
    } else {
      sortSongs(field, "asc")
    }
  }

  function handleSortSelect(value: string) {
    const [field, order] = value.split("-") as [SortField, "asc" | "desc"]
    sortSongs(field, order)
  }

  const sortDropdownValue = `${sortField}-${sortOrder}`

  const toolbar = (
    (showSort || selectMode) ? (
    <div className="flex items-center justify-between px-4 pb-2 shrink-0">
      {/* Select mode toggle */}
      <button
        onClick={() => {
          if (selectMode) {
            setSelectMode(false)
            setSelectedIds(new Set())
            lastSelectedIndexRef.current = null
          } else {
            setSelectMode(true)
          }
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
          selectMode
            ? "text-[var(--aurora-accent-interactive)] bg-[var(--aurora-accent-interactive)]/10"
            : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] hover:bg-white/[0.04]"
        }`}
      >
        {selectMode ? "Done" : "Select"}
      </button>
      {showSort && (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--aurora-text-tertiary)] uppercase tracking-wide">Sort</span>
        <SortDropdown value={sortDropdownValue} onChange={handleSortSelect} />
        <ColumnPicker columnContext={columnContext} />
      </div>
      )}
    </div>
    ) : null
  )

  // ── Virtualizer ──
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const virtualCount = songs.length

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => songs[index]?.id ?? `idx-${index}`,
  })

  // ── Auto-scroll to current song when it changes (G9) ──
  const currentSongId = usePlayerStore((s) => s.currentSong?.id)
  const prevCurrentIdRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (currentSongId === prevCurrentIdRef.current) return
    prevCurrentIdRef.current = currentSongId
    if (currentSongId === undefined) return

    const index = songs.findIndex((s) => s.id === currentSongId)
    if (index === -1) return // current song not in this list — no-op

    // Check if row is offscreen
    const virtualItems = rowVirtualizer.getVirtualItems()
    const isOnscreen = virtualItems.some((v) => v.index === index)
    if (isOnscreen) return

    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Small delay to let the view settle
    const timer = setTimeout(() => {
      rowVirtualizer.scrollToIndex(index, {
        align: "center",
        behavior: prefersReduced ? "auto" : "smooth",
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [currentSongId, songs, rowVirtualizer])

  // ── Infinite scroll via IntersectionObserver (sentinel at content bottom) ──
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    const root = tableContainerRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !useSongStore.getState().loading) {
          fetchMore()
        }
      },
      { root, rootMargin: "0px 0px 300px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, fetchMore])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const topSpacerHeight = virtualItems.length > 0 ? virtualItems[0].start : 0
  const bottomSpacerHeight = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0

  // ── Loading state ──
  if (loading && songs.length === 0) {
    return (
      <div className="w-full overflow-auto aurora-fade-in @container">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            visibleColumns={visibleColumns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
            isDraggable={isDraggable}
          />
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </td>
                <td className="px-4 py-3 hidden @xl:table-cell">
                  <Skeleton className="h-3 w-10" />
                </td>
                <td className="px-4 py-3 hidden @xl:table-cell">
                  <Skeleton className="h-3 w-20" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="w-full aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            visibleColumns={visibleColumns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
            isDraggable={isDraggable}
          />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-8 w-8 text-[var(--aurora-danger)] opacity-50" />
          <p className="font-display-italic text-[20px] text-[var(--aurora-danger)]">
            Failed to load songs
          </p>
          <p className="text-xs text-[var(--aurora-text-secondary)] max-w-xs text-center">
            {error}
          </p>
          <button
            onClick={() => useSongStore.getState().fetchSongs()}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold aurora-btn-press transition-colors duration-150"
            style={{
              background: "var(--aurora-surface)",
              color: "var(--aurora-text-secondary)",
              boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
            }}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Empty state ──
  if (songs.length === 0) {
    return (
      <div className="w-full aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            visibleColumns={visibleColumns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
            isDraggable={isDraggable}
          />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)] opacity-40" />
          <p className="font-display-italic text-[22px] text-[var(--aurora-text-tertiary)]">
            {emptyTitle}
          </p>
          <p className="text-xs text-[var(--aurora-text-tertiary)]">
            {emptyHint}
          </p>
        </div>
      </div>
    )
  }

  // ── Virtualized render ──
  const isLoadingMore = loading && songs.length > 0

  return (
    <div className={fillHeight ? "flex flex-col min-h-0 h-full" : undefined}>
      <div
        ref={tableContainerRef}
        className={fillHeight ? "w-full flex-1 min-h-0 overflow-auto aurora-fade-in @container" : "w-full h-[calc(100vh-15rem)] overflow-auto aurora-fade-in @container"}

      >
        {toolbar}
        <table className="w-full border-separate border-spacing-0" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {isDraggable && <col style={{ width: 24 }} />}
            {selectMode && <col style={{ width: 40 }} />}
            {visibleColumns.map((col) => (
              <col
                key={col.id}
                style={{ width: col.id === "title" ? undefined : (columnConfig.widths[col.id] ?? col.defaultWidth) }}
              />
            ))}
          </colgroup>
          <TableHeader
            visibleColumns={visibleColumns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={selectMode}
            isAllSelected={isAllSelected}
            isIndeterminate={!isAllSelected && selectedIds.size > 0}
            onSelectAll={toggleSelectAll}
            isDraggable={isDraggable}
            onResize={handleResize}
            columnWidths={columnConfig.widths}
          />
          <tbody key={animKey}>
            {/* Top spacer */}
            {topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={tableColspan}
                  style={{ height: topSpacerHeight, padding: 0, border: 0, lineHeight: 0 }}
                />
              </tr>
            )}
            {/* Visible rows — wrapped in dnd-kit context when draggable */}
            {(() => {
              const rowContent = virtualItems.map((virtualRow) => {
                const song = songs[virtualRow.index]
                if (!song) return null
                return (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={virtualRow.index}
                    visibleColumns={visibleColumns}
                    onPlay={onPlay}
                    animIndex={virtualRow.index < 16 ? virtualRow.index : undefined}
                    isSelected={selectedIds.has(song.id) || contextMenu?.song.id === song.id}
                    onToggleSelect={(shiftKey, metaKey) => toggleSelectOne(song.id, shiftKey, metaKey)}
                    onContextMenu={(e) => handleContextMenuEvent(e, song, virtualRow.index)}
                    selectMode={selectMode}
                    onPlayNext={() => usePlayerStore.getState().playNext(song)}
                    onAddToPlaylist={() => { closeContextMenu(); setAddToPlaylistDialogOpen(true) }}
                    onRemoveFromPlaylist={onRemoveFromPlaylist ? () => onRemoveFromPlaylist(song) : undefined}
                    onTrim={onTrim ? () => onTrim(song.id) : undefined}
                    isDraggable={isDraggable}
                  />
                )
              })

              if (isDraggable) {
                const songIds = songs.map(s => s.id)
                return (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={songIds} strategy={verticalListSortingStrategy}>
                      {rowContent}
                    </SortableContext>
                  </DndContext>
                )
              }
              return rowContent
            })()}
            {/* Bottom spacer */}
            {bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={tableColspan}
                  style={{ height: bottomSpacerHeight, padding: 0, border: 0, lineHeight: 0 }}
                />
              </tr>
            )}
            {/* Load-more row */}
            {isLoadingMore && (
              <tr>
                <td colSpan={tableColspan} className="text-center py-4">
                  <span className="inline-flex items-center gap-2 text-[12px] text-[var(--aurora-text-tertiary)]">
                    <span aria-hidden="true" className="inline-block w-3.5 h-3.5 border-2 border-[var(--aurora-accent)] border-t-transparent rounded-full animate-spin" />
                    Loading more songs...
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Sentinel: IntersectionObserver watches this for auto-load */}
        <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px" />

        {/* Song count footer */}
        <div className="sticky bottom-0 text-center py-2.5 text-[11px] text-[var(--aurora-text-tertiary)] bg-[var(--aurora-obsidian)] border-t border-[var(--aurora-rim-bright)] shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.5)]">
          Showing {songs.length} of {totalCount.toLocaleString()}
        </div>
      </div>

      <BulkTagDialog
        open={bulkTagDialogOpen}
        onOpenChange={setBulkTagDialogOpen}
        songIds={selectedIdsArray}
        onComplete={() => { setSelectedIds(new Set()); lastSelectedIndexRef.current = null }}
      />

      <AddToPlaylistDialog
        open={addToPlaylistDialogOpen}
        onOpenChange={setAddToPlaylistDialogOpen}
        songIds={selectedIdsArray}
        onComplete={() => { setSelectedIds(new Set()); lastSelectedIndexRef.current = null }}
      />

      {/* ── Selection-aware context menu (lifted from SongRow) ── */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }}
          />
          <div
            className="fixed z-50 min-w-[200px] max-w-[260px] py-1.5 rounded-lg shadow-xl border"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              background: "var(--aurora-surface-2)",
              borderColor: "var(--aurora-rim)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header: selection count */}
            {selectedIds.size > 1 && selectedIds.has(contextMenu.song.id) && (
              <div className="px-3.5 py-1.5 border-b border-[var(--aurora-rim)] mb-1">
                <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)] tabular-nums">
                  {selectedIds.size} songs
                </span>
              </div>
            )}

            {/* Play Now */}
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={ctxPlayNow}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-accent)]">▶</span>
              Play Now
            </button>

            {/* Play Next */}
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={ctxPlayNext}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-text-secondary)]">↳</span>
              Play Next
            </button>

            {/* Add to Queue */}
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={ctxAddToQueue}
            >
              <ListPlus className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
              Add to Queue
            </button>

            <div className="h-px my-1 bg-[var(--aurora-rim)]" />

            {/* Add to Playlist */}
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={() => { closeContextMenu(); setAddToPlaylistDialogOpen(true) }}
            >
              <ListPlus className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
              Add to Playlist
            </button>

            {/* Add Tag — inline picker */}
            <div className="px-3.5 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <TagIcon className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
                <span className="text-[13px] text-[var(--aurora-text)]">Add Tag</span>
              </div>
              <input
                value={contextTagSearch}
                onChange={(e) => setContextTagSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    ctxAddTag(contextTagSearch)
                  }
                  if (e.key === "Escape") closeContextMenu()
                }}
                placeholder="Type and press Enter…"
                className="w-full text-[12px] px-2.5 py-1.5 rounded-md bg-transparent border border-[var(--aurora-rim)] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] focus:outline-none focus:border-[var(--aurora-accent-interactive)]"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              {/* Quick-pick existing tags */}
              {contextTagSearch === "" && (
                <div className="mt-1.5 max-h-[100px] overflow-y-auto">
                  {allTags.slice(0, 8).map((tag) => (
                    <button
                      key={tag.id}
                      className="w-full text-left px-2 py-1 text-[11px] text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface-hover)] rounded transition-colors"
                      onClick={(e) => { e.stopPropagation(); ctxAddTag(tag.name) }}
                    >
                      {tag.name}
                      <span className="ml-1 text-[var(--aurora-text-tertiary)] tabular-nums">{tag.song_count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Remove from Playlist (playlist view only) */}
            {onRemoveFromPlaylist && (
              <>
                <div className="h-px my-1 bg-[var(--aurora-rim)]" />
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-colors text-left"
                  onClick={ctxRemoveFromPlaylist}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove from Playlist
                </button>
              </>
            )}

            {/* Edit Tags / Edit Song (single-song actions) */}
            {contextTargets.length === 1 && (
              <>
                <div className="h-px my-1 bg-[var(--aurora-rim)]" />
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
                  onClick={() => { const song = contextTargets[0]; closeContextMenu(); setContextEditSong(song) }}
                >
                  <Pencil className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
                  Edit Song
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
                  onClick={() => { const song = contextTargets[0]; closeContextMenu(); setContextTagSong(song) }}
                >
                  <TagIcon className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
                  Edit Tags
                </button>
                {onTrim && (
                  <button
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
                    onClick={() => { const song = contextTargets[0]; closeContextMenu(); onTrim(song.id) }}
                  >
                    <Scissors className="h-3.5 w-3.5 text-[var(--aurora-text-secondary)]" />
                    Trim
                  </button>
                )}
              </>
            )}

            {/* Delete */}
            <div className="h-px my-1 bg-[var(--aurora-rim)]" />
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-colors text-left"
              onClick={ctxDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Edit Song dialog (from right-click context menu) */}
      {contextEditSong && (
        <EditSongDialog
          song={contextEditSong}
          open={true}
          onOpenChange={(open) => { if (!open) setContextEditSong(null) }}
        />
      )}

      {/* Tag Editor dialog (from right-click context menu) */}
      {contextTagSong && (
        <TagEditor
          songId={contextTagSong.id}
          songTitle={contextTagSong.title}
          currentTags={contextTagSong.tags}
          open={true}
          onOpenChange={(open) => { if (!open) setContextTagSong(null) }}
        />
      )}
    </div>
  )
}
