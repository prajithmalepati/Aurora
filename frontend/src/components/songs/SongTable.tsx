import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useSongStore } from "@/stores/songStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import type { Song } from "@/types"
import { SongRow } from "./SongRow"
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
import { Music, ChevronUp, ChevronDown, AlertTriangle, RefreshCw, Play, ListPlus, Tag as TagIcon, X } from "lucide-react"

interface SongTableProps {
  songs: Song[]
  loading?: boolean
  error?: string | null
  onPlay?: (song: Song, index: number) => void
  animKey?: number
  showSort?: boolean
}

const HEADER_CLASS =
  "px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] font-medium"

type SortField = "title" | "artist" | "album" | "duration" | "created_at"

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
  sortField: SortField
  sortOrder: "asc" | "desc"
  onSort: (field: SortField) => void
  showCheckbox: boolean
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectAll: () => void
}

function TableHeader({ sortField, sortOrder, onSort, showCheckbox, isAllSelected, isIndeterminate, onSelectAll }: TableHeaderProps) {
  const SortArrow = sortOrder === "asc" ? ChevronUp : ChevronDown

  function SortableTh({
    field,
    label,
    className,
  }: {
    field: SortField
    label: string
    className?: string
  }) {
    const active = sortField === field
    return (
      <th
        className={`${HEADER_CLASS} cursor-pointer select-none hover:text-[var(--aurora-text-secondary)] ${active ? "text-[var(--aurora-text-secondary)]" : ""} ${className ?? ""}`}
        onClick={() => onSort(field)}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active && <SortArrow className="h-2.5 w-2.5" />}
        </span>
      </th>
    )
  }

  return (
    <thead>
      <tr>
        {showCheckbox && (
          <th className="px-2 py-3 w-10 text-center">
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={onSelectAll}
              ariaLabel="Select all songs"
            />
          </th>
        )}
        <th className={`${HEADER_CLASS} w-12 text-center`}>#</th>
        <SortableTh field="title" label="Title" />
        <SortableTh field="duration" label="Duration" className="w-28 hidden lg:table-cell" />
        <th className={`${HEADER_CLASS} w-40 hidden lg:table-cell`}>Playlists</th>
        <th className={`${HEADER_CLASS} max-w-[200px]`}>Tags</th>
        <th className={`${HEADER_CLASS} w-32 text-right`}>Actions</th>
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

// ── SongTable ──

const ROW_HEIGHT = 64
const OVERSCAN = 10
const TABLE_COLSPAN = 7

export function SongTable({ songs, loading = false, error = null, onPlay, animKey, showSort = true }: SongTableProps) {
  const sortField = useSongStore((state) => state.sortField)
  const sortOrder = useSongStore((state) => state.sortOrder)
  const sortSongs = useSongStore((state) => state.sortSongs)
  const totalCount = useSongStore((state) => state.totalCount)
  const hasMore = useSongStore((state) => state.hasMore)
  const fetchMore = useSongStore((state) => state.fetchMore)

  const playSong = usePlayerStore((s) => s.playSong)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)
  const showBulkBar = selectedIds.size > 0

  // Bulk dialog state
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [addToPlaylistDialogOpen, setAddToPlaylistDialogOpen] = useState(false)

  // Only clear selection when songs are replaced (first ID changes), not when appended
  const firstIdRef = useRef<number | null>(songs[0]?.id ?? null)
  useEffect(() => {
    const newFirstId = songs[0]?.id ?? null
    if (newFirstId !== firstIdRef.current) {
      setSelectedIds(new Set())
      lastSelectedIndexRef.current = null
    }
    firstIdRef.current = newFirstId
  }, [songs])

  const isAllSelected = songs.length > 0 && songs.every((s) => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(songs.map((s) => s.id)))
    }
    lastSelectedIndexRef.current = null
  }

  const toggleSelectOne = useCallback((songId: number, shiftKey: boolean) => {
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
  }, [songs])

  // Bulk actions
  const getSelectedSongs = useCallback((): Song[] => {
    return songs.filter((s) => selectedIds.has(s.id))
  }, [songs, selectedIds])

  const handlePlaySelected = () => {
    const selected = getSelectedSongs()
    const playable = selected.filter((s) => s.file_path)
    if (playable.length === 0) {
      toast.error("No playable files in selection")
      return
    }
    playSong(playable[0], playable)
  }

  const handleAddSelectedToQueue = () => {
    const selected = getSelectedSongs()
    const playable = selected.filter((s) => s.file_path)
    if (playable.length === 0) {
      toast.error("No playable files in selection")
      return
    }
    for (const s of playable) {
      addToQueue(s)
    }
    toast.success(`${playable.length} song${playable.length === 1 ? "" : "s"} added to queue`)
  }

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  function handleColumnSort(field: SortField) {
    if (field === sortField) {
      sortSongs(field, sortOrder === "asc" ? "desc" : "asc")
    } else {
      sortSongs(field, "asc")
    }
  }

  function handleDropdownChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [field, order] = e.target.value.split("-") as [SortField, "asc" | "desc"]
    sortSongs(field, order)
  }

  const sortDropdownValue = `${sortField}-${sortOrder}`

  const toolbar = showSort ? (
    <div className="flex items-center justify-end px-4 pb-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--aurora-text-tertiary)] uppercase tracking-wide">Sort</span>
        <select
          value={sortDropdownValue}
          onChange={handleDropdownChange}
          className="text-[11px] bg-transparent text-[var(--aurora-text-secondary)] border border-[var(--aurora-rim)] rounded px-2 py-1 focus:outline-none cursor-pointer hover:border-[var(--aurora-muted)]"
        >
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="artist-asc">Artist A–Z</option>
          <option value="artist-desc">Artist Z–A</option>
          <option value="album-asc">Album A–Z</option>
          <option value="album-desc">Album Z–A</option>
          <option value="duration-asc">Duration ↑</option>
          <option value="duration-desc">Duration ↓</option>
          <option value="created_at-desc">Newest first</option>
          <option value="created_at-asc">Oldest first</option>
        </select>
      </div>
    </div>
  ) : null

  // Bulk action bar
  const bulkBar = showBulkBar ? (
    <div
      className="flex items-center gap-3 px-4 py-2 mb-2 rounded-lg aurora-fade-in shrink-0"
      style={{
        background: "var(--aurora-surface-2)",
        border: "1px solid var(--aurora-rim)",
      }}
    >
      <span className="text-[12px] font-medium text-[var(--aurora-text)] tabular-nums">
        {selectedIds.size} selected
      </span>
      <div className="flex-1" />
      <button
        onClick={handlePlaySelected}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-text)] hover:bg-white/[0.06] transition-colors duration-150"
        title="Play selected"
      >
        <Play className="h-3.5 w-3.5" />
        Play
      </button>
      <button
        onClick={handleAddSelectedToQueue}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-text)] hover:bg-white/[0.06] transition-colors duration-150"
        title="Add to queue"
      >
        <ListPlus className="h-3.5 w-3.5" />
        Queue
      </button>
      <button
        onClick={() => setAddToPlaylistDialogOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-text)] hover:bg-white/[0.06] transition-colors duration-150"
        title="Add to playlist"
      >
        <ListPlus className="h-3.5 w-3.5" />
        Playlist
      </button>
      <button
        onClick={() => setBulkTagDialogOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-text)] hover:bg-white/[0.06] transition-colors duration-150"
        title="Tag selected"
      >
        <TagIcon className="h-3.5 w-3.5" />
        Tag
      </button>
      <button
        onClick={() => { setSelectedIds(new Set()); lastSelectedIndexRef.current = null }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-colors duration-150"
        title="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  ) : null

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

  // Infinite scroll: fetch more when scrolled near the bottom
  const handleScroll = useCallback(() => {
    const el = tableContainerRef.current
    if (!el || !hasMore || useSongStore.getState().loading) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 300) {
      fetchMore()
    }
  }, [hasMore, fetchMore])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const topSpacerHeight = virtualItems.length > 0 ? virtualItems[0].start : 0
  const bottomSpacerHeight = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0

  // ── Loading state ──
  if (loading && songs.length === 0) {
    return (
      <div className="w-full overflow-auto aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
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
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Skeleton className="h-3 w-10" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
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
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
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
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox={false}
            isAllSelected={false}
            isIndeterminate={false}
            onSelectAll={toggleSelectAll}
          />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)] opacity-40" />
          <p className="font-display-italic text-[22px] text-[var(--aurora-text-tertiary)]">
            Nothing here yet
          </p>
          <p className="text-xs text-[var(--aurora-text-tertiary)]">
            Scan a folder or add a song to begin.
          </p>
        </div>
      </div>
    )
  }

  // ── Virtualized render ──
  const isLoadingMore = loading && songs.length > 0

  return (
    <>
      <div
        ref={tableContainerRef}
        className="w-full h-[calc(100vh-15rem)] overflow-auto aurora-fade-in"
        onScroll={handleScroll}
      >
        {toolbar}
        {bulkBar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleColumnSort}
            showCheckbox
            isAllSelected={isAllSelected}
            isIndeterminate={!isAllSelected && selectedIds.size > 0}
            onSelectAll={toggleSelectAll}
          />
          <tbody key={animKey}>
            {/* Top spacer */}
            {topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={TABLE_COLSPAN}
                  style={{ height: topSpacerHeight, padding: 0, border: 0, lineHeight: 0 }}
                />
              </tr>
            )}
            {/* Visible rows */}
            {virtualItems.map((virtualRow) => {
              const song = songs[virtualRow.index]
              if (!song) return null
              return (
                <SongRow
                  key={song.id}
                  song={song}
                  index={virtualRow.index}
                  onPlay={onPlay}
                  animIndex={virtualRow.index < 16 ? virtualRow.index : undefined}
                  isSelected={selectedIds.has(song.id)}
                  onToggleSelect={(shiftKey) => toggleSelectOne(song.id, shiftKey)}
                />
              )
            })}
            {/* Bottom spacer */}
            {bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={TABLE_COLSPAN}
                  style={{ height: bottomSpacerHeight, padding: 0, border: 0, lineHeight: 0 }}
                />
              </tr>
            )}
            {/* Load-more row */}
            {isLoadingMore && (
              <tr>
                <td colSpan={TABLE_COLSPAN} className="text-center py-4">
                  <span className="inline-flex items-center gap-2 text-[12px] text-[var(--aurora-text-tertiary)]">
                    <div className="w-3.5 h-3.5 border-2 border-[var(--aurora-accent)] border-t-transparent rounded-full animate-spin" />
                    Loading more songs...
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Song count footer */}
        <div className="sticky bottom-0 text-center py-2.5 text-[11px] text-[var(--aurora-text-tertiary)] bg-[var(--aurora-obsidian)]/90 backdrop-blur-sm border-t border-[var(--aurora-rim)]">
          Showing {songs.length} of {totalCount.toLocaleString()}
          {hasMore && !isLoadingMore && (
            <button
              onClick={fetchMore}
              className="ml-2 text-[var(--aurora-accent)] hover:underline cursor-pointer"
            >
              Load more
            </button>
          )}
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
    </>
  )
}
