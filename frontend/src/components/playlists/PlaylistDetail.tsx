import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import type { PlaylistSong, PlaylistDetail as PlaylistDetailType } from "@/types"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useSongStore } from "@/stores/songStore"
import { usePlayerStore } from "@/stores/playerStore"
import { formatDuration } from "@/lib/utils"
import { albumGradient } from "@/lib/albumGradient"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"
import { Pencil, Trash2, X, Search, Scissors, Sparkles, ArrowUpDown, ArrowLeft, AlertTriangle, Play, ListPlus, Download, GripVertical } from "lucide-react"
import { AuroraPlayButton } from "@/components/player/AuroraPlayButton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSettingsStore } from "@/stores/settingsStore"
import { TagList } from "@/components/tags/TagList"
import { Skeleton } from "@/components/ui/skeleton"
import { Equalizer } from "@/components/ui/Equalizer"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { PlaylistImagePicker } from "@/components/playlists/PlaylistImagePicker"
import { WaveformTrimEditor } from "@/components/player/WaveformTrimEditor"
import { api, BASE_URL, getBaseUrl } from "@/lib/api"

interface PlaylistDetailProps {
  playlistId: number
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylistDetail = usePlaylistStore((state) => state.fetchPlaylistDetail)
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist)
  const removeSongFromPlaylist = usePlaylistStore((state) => state.removeSongFromPlaylist)
  const reorderSongs = usePlaylistStore((state) => state.reorderSongs)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)

  const playSong = usePlayerStore((state) => state.playSong)
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const activePlaylist = usePlaylistStore((state) => state.activePlaylist)
  const loading = usePlaylistStore((state) => state.detailLoading)
  const error = usePlaylistStore((state) => state.error)

  const [openTrimId, setOpenTrimId] = useState<number | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editEmoji, setEditEmoji] = useState("")
  const [editImageDataUrl, setEditImageDataUrl] = useState<string | null>(null)
  const [editCrossfadeEnabled, setEditCrossfadeEnabled] = useState(false)
  const [editCrossfadeDuration, setEditCrossfadeDuration] = useState(5)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<'position'|'title'|'artist'|'album'|'duration'>('position')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastCheckedId, setLastCheckedId] = useState<number | null>(null)
  const showBulkBar = selectedIds.size > 0

  // Drag-and-drop state
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  // Bulk remove confirmation dialog
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false)

  // Undo state for bulk remove
  const [removedSongs, setRemovedSongs] = useState<PlaylistSong[] | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchPlaylistDetail(playlistId)
    // Clear selection and undo state when changing playlists
    setSelectedIds(new Set())
    setLastCheckedId(null)
    setRemovedSongs(null)
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
    }
  }, [playlistId, fetchPlaylistDetail])

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set())
    setLastCheckedId(null)
  }, [searchQuery])

  const filteredSongs = useMemo(() => {
    if (!activePlaylist) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return activePlaylist.songs
    return activePlaylist.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist ?? "").toLowerCase().includes(q)
    )
  }, [activePlaylist, searchQuery])

  const sortedSongs = useMemo(() => {
    if (sortField === 'position') return filteredSongs
    return [...filteredSongs].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortField === 'title')    { va = a.title.toLowerCase(); vb = b.title.toLowerCase() }
      if (sortField === 'artist')   { va = (a.artist ?? '').toLowerCase(); vb = (b.artist ?? '').toLowerCase() }
      if (sortField === 'album')    { va = (a.album ?? '').toLowerCase(); vb = (b.album ?? '').toLowerCase() }
      if (sortField === 'duration') { va = a.duration ?? 0; vb = b.duration ?? 0 }
      if (va < vb) return sortOrder === 'asc' ? -1 : 1
      if (va > vb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredSongs, sortField, sortOrder])

  const heroArt = useMemo(
    () => albumGradient(activePlaylist?.songs[0]?.id?.toString() ?? activePlaylist?.name ?? `playlist-${playlistId}`),
    [activePlaylist?.songs, activePlaylist?.name, playlistId]
  )

  // Server-stored image URL (comes back from the API on every fetchPlaylistDetail)
  const heroImage = activePlaylist?.image_url ? `${getBaseUrl()}${activePlaylist.image_url}` : null

  // Neutral dark gradient for the hero tile — no teal/violet bias.
  // If the playlist has a custom accent colour we let a whisper of it through.
  const heroTileGradient = useMemo(() => {
    const accent = activePlaylist?.color
    return accent
      ? `linear-gradient(135deg, ${accent}22 0%, var(--aurora-surface-1) 100%)`
      : "linear-gradient(135deg, var(--aurora-surface-3) 0%, var(--aurora-surface-1) 100%)"
  }, [activePlaylist?.color])

  const totalDuration = useMemo(() => {
    if (!activePlaylist) return 0
    return activePlaylist.songs.reduce((sum, s) => sum + (s.duration ?? 0), 0)
  }, [activePlaylist])

  // 2x2 art grid: first 4 songs with embedded art, shown only when playlist has no custom image
  const songsWithArt = useMemo(
    () =>
      activePlaylist && !activePlaylist.image_url
        ? activePlaylist.songs.filter((s) => s.album_art_path)
        : [],
    [activePlaylist]
  )
  const showArtGrid = songsWithArt.length >= 4
  const gridSongs = showArtGrid ? songsWithArt.slice(0, 4) : []

  const handleExport = async (format: 'm3u' | 'm3u8' | 'json') => {
    if (!activePlaylist) return
    try {
      const response = await fetch(`${BASE_URL}/playlists/${activePlaylist.id}/export?format=${format}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Export failed' }))
        throw new Error(err.detail || 'Export failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ext = format === 'json' ? 'aurora.json' : format
      a.href = url
      a.download = `${activePlaylist.name.replace(/[\\/*?:"<>|]/g, '_')}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    }
  }

  const handleEdit = () => {
    if (activePlaylist) {
      setEditName(activePlaylist.name)
      setEditColor(activePlaylist.color || "")
      setEditEmoji(activePlaylist.emoji || "")
      // Seed picker with the current server URL (displays as <img src>)
      setEditImageDataUrl(activePlaylist.image_url ? `${getBaseUrl()}${activePlaylist.image_url}` : null)
      // Seed crossfade settings
      setEditCrossfadeEnabled(
        activePlaylist.crossfade_enabled !== null && activePlaylist.crossfade_enabled !== undefined
          ? activePlaylist.crossfade_enabled === 1
          : useSettingsStore.getState().crossfadeEnabled
      )
      setEditCrossfadeDuration(
        activePlaylist.crossfade_duration_s ?? useSettingsStore.getState().crossfadeDuration
      )
      setEditDialogOpen(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!activePlaylist) return
    if (!editName.trim()) {
      toast.error("Name is required")
      return
    }
    try {
      const playlistStore = usePlaylistStore.getState()

      if (editImageDataUrl?.startsWith("data:")) {
        // New file was picked — convert base64 preview to Blob and upload
        const blob = await fetch(editImageDataUrl).then((r) => r.blob())
        const ext =
          blob.type === "image/png" ? "png"
          : blob.type === "image/gif" ? "gif"
          : blob.type === "image/webp" ? "webp"
          : "jpg"
        const formData = new FormData()
        formData.append("file", blob, `image.${ext}`)
        await api.upload(`/playlists/${activePlaylist.id}/image`, formData)
      } else if (editImageDataUrl === null && activePlaylist.image_url) {
        // User removed the existing image
        await api.delete(`/playlists/${activePlaylist.id}/image`)
      }

      await playlistStore.updatePlaylist(activePlaylist.id, {
        name: editName.trim(),
        color: editColor.trim() || undefined,
        emoji: editEmoji.trim(),
        crossfade_enabled: editCrossfadeEnabled ? 1 : 0,
        crossfade_duration_s: editCrossfadeEnabled ? editCrossfadeDuration : null,
      })
      setEditDialogOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update playlist"
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    if (!activePlaylist) return
    try {
      await deletePlaylist(activePlaylist.id)
      toast.success("Playlist deleted")
      setView({ kind: "all-songs" })
      setDeleteDialogOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete playlist"
      toast.error(message)
      setDeleteDialogOpen(false)
    }
  }

  // ── Selection helpers ──

  const isAllSelected = sortedSongs.length > 0 && sortedSongs.every(s => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedSongs.map(s => s.id)))
    }
    setLastCheckedId(null)
  }

  const toggleSelectOne = (songId: number, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey && lastCheckedId !== null) {
        // Range select: find indices in sortedSongs
        const ids = sortedSongs.map(s => s.id)
        const lastIdx = ids.indexOf(lastCheckedId)
        const currIdx = ids.indexOf(songId)
        if (lastIdx !== -1 && currIdx !== -1) {
          const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
          for (let i = from; i <= to; i++) {
            next.add(ids[i])
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
    setLastCheckedId(songId)
  }

  // ── Single song remove with undo ──

  const handleRemoveSong = async (song: PlaylistSong) => {
    if (!activePlaylist) return
    try {
      await removeSongFromPlaylist(activePlaylist.id, song.id)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(song.id)
        return next
      })
      showUndoToast([song])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove song"
      toast.error(message)
    }
  }

  // ── Undo toast ──

  const showUndoToast = (songs: PlaylistSong[]) => {
    setRemovedSongs(songs)
    const count = songs.length
    const label = count === 1 ? "1 song removed" : `${count} songs removed`

    // Clear any previous timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
    }

    const toastId = toast(label, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => handleUndoRemove(),
      },
    })

    // Auto-clear undo state after 5s
    undoTimeoutRef.current = setTimeout(() => {
      setRemovedSongs(null)
      toast.dismiss(toastId)
    }, 5000)
  }

  const handleUndoRemove = async () => {
    if (!activePlaylist || !removedSongs) return
    const songs = removedSongs
    setRemovedSongs(null)
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
    }

    try {
      // Re-add each song (they'll be appended at the end)
      for (const s of songs) {
        await api.post(`/playlists/${activePlaylist.id}/songs`, { song_id: s.id })
      }
      // Reorder to restore original positions
      const currentSongs = activePlaylist.songs
      const restoredSongs = [...currentSongs]
      for (const s of songs) {
        if (!restoredSongs.find(x => x.id === s.id)) {
          restoredSongs.push(s)
        }
      }
      // Reorder: place each restored song at its original position
      // First, remove all restored songs, then insert them at their positions
      const withoutRestored = restoredSongs.filter(s => !songs.find(rs => rs.id === s.id))
      // Insert restored songs at their positions, sorted by position ascending
      const sortedRestored = [...songs].sort((a, b) => a.position - b.position)
      for (const rs of sortedRestored) {
        const insertAt = Math.min(rs.position, withoutRestored.length)
        withoutRestored.splice(insertAt, 0, rs)
      }
      const orderedIds = withoutRestored.map(s => s.id)
      await reorderSongs(activePlaylist.id, orderedIds)
      await fetchPlaylistDetail(activePlaylist.id)
      toast.success("Undo successful")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to undo"
      toast.error(message)
      // Refetch to ensure consistent state
      if (activePlaylist) fetchPlaylistDetail(activePlaylist.id)
    }
  }

  // ── Bulk operations ──

  const getSelectedSongs = (): PlaylistSong[] => {
    if (!activePlaylist) return []
    return activePlaylist.songs.filter(s => selectedIds.has(s.id))
  }

  const handlePlaySelected = () => {
    const selected = getSelectedSongs()
    if (selected.length === 0) return
    const songsWithFile = selected.filter(s => s.file_path)
    if (songsWithFile.length === 0) {
      toast.error("No playable files in selection")
      return
    }
    const asSongs = songsWithFile.map(s => ({
      ...s,
      source: "local" as const,
      playlists: [],
      created_at: "",
      updated_at: "",
    }))
    playSong(asSongs[0], asSongs, activePlaylist?.id ?? null)
  }

  const handleAddSelectedToQueue = () => {
    const selected = getSelectedSongs()
    if (selected.length === 0) return
    const songsWithFile = selected.filter(s => s.file_path)
    if (songsWithFile.length === 0) {
      toast.error("No playable files in selection")
      return
    }
    for (const s of songsWithFile) {
      addToQueue({
        ...s,
        source: "local" as const,
        playlists: [],
        created_at: "",
        updated_at: "",
      })
    }
    toast.success(`${songsWithFile.length} song${songsWithFile.length === 1 ? '' : 's'} added to queue`)
  }

  const handleBulkRemove = async () => {
    if (!activePlaylist) return
    const selected = getSelectedSongs()
    if (selected.length === 0) return

    // Snapshot before removal for undo
    const snapshot = [...selected]

    try {
      // Remove each song individually via the API
      for (const s of selected) {
        await api.delete(`/playlists/${activePlaylist.id}/songs/${s.id}`)
      }
      // Update sidebar counts and refetch detail
      await fetchPlaylists()
      await fetchPlaylistDetail(activePlaylist.id)
      setSelectedIds(new Set())
      setLastCheckedId(null)
      setBulkRemoveDialogOpen(false)
      showUndoToast(snapshot)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove songs"
      toast.error(message)
      setBulkRemoveDialogOpen(false)
    }
  }

  // ── Drag-and-drop ──

  const isDragEnabled = sortField === 'position'

  const handleDragStart = useCallback((e: React.DragEvent, songId: number) => {
    if (!isDragEnabled) {
      e.preventDefault()
      return
    }
    setDragId(songId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(songId))
    // Slight delay for visual feedback
    requestAnimationFrame(() => {
      const el = e.currentTarget as HTMLElement
      el.style.opacity = "0.4"
    })
  }, [isDragEnabled])

  const handleDragOver = useCallback((e: React.DragEvent, songId: number) => {
    e.preventDefault()
    if (dragId !== songId) {
      setDragOverId(songId)
    }
    e.dataTransfer.dropEffect = "move"
  }, [dragId])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    if (!activePlaylist || !dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }

    const songs = activePlaylist.songs
    const dragIndex = songs.findIndex(s => s.id === dragId)
    const dropIndex = songs.findIndex(s => s.id === targetId)
    if (dragIndex === -1 || dropIndex === -1) {
      setDragId(null)
      setDragOverId(null)
      return
    }

    // Compute new order
    const newSongs = [...songs]
    const [moved] = newSongs.splice(dragIndex, 1)
    newSongs.splice(dropIndex, 0, moved)
    const newOrderedIds = newSongs.map(s => s.id)

    // Optimistic update
    usePlaylistStore.setState({
      activePlaylist: { ...activePlaylist, songs: newSongs }
    })

    setDragId(null)
    setDragOverId(null)

    try {
      await reorderSongs(activePlaylist.id, newOrderedIds)
    } catch (err: unknown) {
      // Revert on failure
      const message = err instanceof Error ? err.message : "Failed to reorder songs"
      toast.error(message)
      fetchPlaylistDetail(activePlaylist.id)
    }
  }, [activePlaylist, dragId, reorderSongs, fetchPlaylistDetail])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = ""
    setDragId(null)
    setDragOverId(null)
  }, [])

  const handlePlaySong = (song: PlaylistSong) => {
    if (!song.file_path || !activePlaylist) return
    const queue = activePlaylist.songs
      .filter((s) => s.file_path)
      .map((s) => ({
        ...s,
        source: "local" as const,
        playlists: [],
        created_at: "",
        updated_at: "",
      }))
    const asSong = { ...song, source: "local" as const, playlists: [], created_at: "", updated_at: "" }
    playSong(asSong, queue, activePlaylist.id)
  }

  if (loading) {
    return (
      <div className="p-10 space-y-6 aurora-fade-in">
        <div className="flex items-end gap-6">
          <Skeleton className="h-40 w-40 rounded-lg" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="space-y-2 mt-8">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!activePlaylist) {
    if (error) {
      return (
        <div className="p-10 flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-8 w-8 text-[var(--aurora-danger)] opacity-50" />
          <p className="font-display-italic text-[20px] text-[var(--aurora-danger)]">
            Failed to load playlist
          </p>
          <p className="text-xs text-[var(--aurora-text-secondary)] max-w-xs text-center">
            {error}
          </p>
          <button
            onClick={() => setView({ kind: "all-songs" })}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold aurora-btn-press transition-colors duration-150"
            style={{
              background: "var(--aurora-surface)",
              color: "var(--aurora-text-secondary)",
              boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
            }}
          >
            <ArrowLeft className="h-3 w-3" />
            Go back
          </button>
        </div>
      )
    }
    return (
      <div className="p-10">
        <span className="font-display-italic text-[20px] text-[var(--aurora-text-tertiary)]">
          Playlist not found
        </span>
      </div>
    )
  }

  const formatTotal = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const hours = Math.floor(mins / 60)
    if (hours > 0) return `${hours} hr ${mins % 60} min`
    return `${mins} min`
  }

  return (
    <div className="aurora-view-enter">
      {/* ── HERO HEADER ── */}
      <div className="relative px-10 pt-10 pb-8 overflow-hidden">
        {/* Background halo derived from playlist art */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 700px 400px at 18% 0%, ${heroArt.glow} 0%, transparent 65%)`,
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-end gap-7">
          {/* Hero art tile */}
          <div
            className="w-[168px] h-[168px] rounded-xl flex-shrink-0 aurora-rim overflow-hidden flex items-center justify-center text-5xl"
            style={{
              background: heroImage || showArtGrid ? undefined : heroTileGradient,
              boxShadow: `0 20px 60px -20px ${heroArt.glow}, inset 0 0 0 1px var(--aurora-rim)`,
            }}
          >
            {heroImage ? (
              <img src={heroImage} alt="" className="w-full h-full object-cover" />
            ) : showArtGrid ? (
              <div className="grid grid-cols-2 w-full h-full">
                {gridSongs.map((s) => (
                  <AlbumArt key={s.id} song={s} size="fill" className="rounded-none" />
                ))}
              </div>
            ) : (
              activePlaylist.emoji && <span>{activePlaylist.emoji}</span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0 pb-2">
            <p className="label-micro mb-3 tracking-[0.2em]">Playlist</p>
            <h1 className="font-display text-[64px] leading-[0.95] tracking-tight text-[var(--aurora-text)] truncate">
              {activePlaylist.name}
            </h1>
            <div className="flex items-center gap-2 mt-4 text-[12px] text-[var(--aurora-text-secondary)]">
              <span className="tabular-nums font-medium">
                {activePlaylist.songs.length} {activePlaylist.songs.length === 1 ? "song" : "songs"}
              </span>
              {totalDuration > 0 && (
                <>
                  <span className="text-[var(--aurora-text-tertiary)]">·</span>
                  <span className="tabular-nums">{formatTotal(totalDuration)}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pb-4">
            {activePlaylist && (
              <CrossfadeChip playlist={activePlaylist} />
            )}
            <Popover>
              <PopoverTrigger
                title="Export playlist"
                aria-label="Export playlist"
                className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-all duration-150"
              >
                <Download className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                {([
                  { format: 'm3u8', label: 'M3U8 (UTF-8)' },
                  { format: 'm3u', label: 'M3U' },
                  { format: 'json', label: 'Aurora JSON' },
                ] as const).map(({ format, label }) => (
                  <button
                    key={format}
                    className="w-full text-left px-3 py-1.5 text-[12px] rounded-sm transition-colors duration-100 hover:bg-[var(--aurora-surface-hover)] text-[var(--aurora-text-secondary)]"
                    onClick={() => handleExport(format)}
                  >
                    {label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <button
              onClick={handleEdit}
              title="Edit playlist"
              aria-label="Edit playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-all duration-150"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete playlist"
              aria-label="Delete playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-all duration-150"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fade divider before song list */}
      <div className="aurora-divider-h mx-10" />

      {/* ── SONG LIST ── */}
      <div className="px-6 py-4">
        {activePlaylist.songs.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div
              className="search-shell relative flex-1 flex items-center rounded-full transition-all duration-200"
              style={{
                background: "var(--aurora-surface)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <Search
                className="absolute left-4 h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Search in playlist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-none pl-11 pr-5 py-2.5 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic placeholder:text-[14px] focus-visible:shadow-none"
              />
            </div>
            <Popover>
              <PopoverTrigger
                className="shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 aurora-focus"
                style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
                aria-label="Sort options"
              >
                <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.5} />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                {([
                  { field: 'position', label: 'Position' },
                  { field: 'title',    label: 'Title' },
                  { field: 'artist',   label: 'Artist' },
                  { field: 'album',    label: 'Album' },
                  { field: 'duration', label: 'Duration' },
                ] as { field: typeof sortField; label: string }[]).map(({ field, label }) => {
                  const active = sortField === field
                  return (
                    <button
                      key={field}
                      className={`w-full text-left px-3 py-1.5 text-[12px] rounded-sm flex items-center justify-between transition-colors duration-100 hover:bg-[var(--aurora-surface-hover)] ${active ? 'text-[var(--aurora-text)]' : 'text-[var(--aurora-text-secondary)]'}`}
                      onClick={() => {
                        if (active) { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }
                        else { setSortField(field); setSortOrder('asc') }
                      }}
                    >
                      <span>{label}</span>
                      {active && (sortOrder === 'asc'
                        ? <span className="h-3 w-3">↑</span>
                        : <span className="h-3 w-3">↓</span>)}
                    </button>
                  )
                })}
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* ── Bulk Actions Bar ── */}
        {showBulkBar && (
          <div
            className="flex items-center gap-3 px-4 py-2 mb-2 rounded-lg aurora-fade-in"
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
              onClick={() => setBulkRemoveDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-colors duration-150"
              title="Remove selected"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        )}

        {activePlaylist.songs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[22px] text-[var(--aurora-text-tertiary)]">
              This playlist is empty
            </p>
          </div>
        ) : sortedSongs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display-italic text-[18px] text-[var(--aurora-text-tertiary)]">
              No songs match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {isDragEnabled && (
                  <th className="px-1 py-3 w-6" />
                )}
                <th className="px-2 py-3 w-10 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={!isAllSelected && selectedIds.size > 0}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all songs"
                  />
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] w-12 text-center">
                  #
                </th>
                <th
                  className={`px-4 py-3 text-left label-micro text-[10px] cursor-pointer select-none transition-colors duration-150 hover:text-[var(--aurora-text-secondary)] ${sortField === 'title' ? 'text-[var(--aurora-text)]' : 'text-[var(--aurora-text-tertiary)]'}`}
                  onClick={() => sortField === 'title' ? setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') : (setSortField('title'), setSortOrder('asc'))}
                >
                  <span className="inline-flex items-center gap-1">Title{sortField === 'title' && (sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>)}</span>
                </th>
                <th
                  className={`px-4 py-3 text-left label-micro text-[10px] w-24 cursor-pointer select-none transition-colors duration-150 hover:text-[var(--aurora-text-secondary)] ${sortField === 'duration' ? 'text-[var(--aurora-text)]' : 'text-[var(--aurora-text-tertiary)]'}`}
                  onClick={() => sortField === 'duration' ? setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') : (setSortField('duration'), setSortOrder('asc'))}
                >
                  <span className="inline-flex items-center gap-1">Duration{sortField === 'duration' && (sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>)}</span>
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)]">
                  Tags
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] w-36 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSongs.map((song) => {
                const originalIndex = activePlaylist.songs.findIndex((s) => s.id === song.id)
                return (
                  <PlaylistSongRow
                    key={song.id}
                    song={song}
                    index={originalIndex}
                    onRemove={() => handleRemoveSong(song)}
                    onPlay={handlePlaySong}
                    openTrimId={openTrimId}
                    setOpenTrimId={setOpenTrimId}
                    // Multi-select
                    isSelected={selectedIds.has(song.id)}
                    onToggleSelect={(shiftKey) => toggleSelectOne(song.id, shiftKey)}
                    // Drag-and-drop
                    isDragEnabled={isDragEnabled}
                    dragId={dragId}
                    dragOverId={dragOverId}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
            <DialogHeader>
              <DialogTitle className="font-display text-[24px]">Edit Playlist</DialogTitle>
              <DialogDescription className="text-[var(--aurora-text-secondary)]">
                Update your playlist details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="label-micro text-[10px]">Cover</label>
                <PlaylistImagePicker
                  name={editName}
                  imageDataUrl={editImageDataUrl}
                  onImageChange={setEditImageDataUrl}
                />
              </div>

              <div className="space-y-2">
                <label className="label-micro text-[10px]">Name</label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="label-micro text-[10px]">Color (optional)</label>
                <Input
                  type="text"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="#5eead4"
                />
              </div>

              <div className="space-y-2">
                <label className="label-micro text-[10px]">Emoji (optional)</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    placeholder="🎸"
                    className="pr-20"
                  />
                  {editEmoji && (
                    <button
                      type="button"
                      onClick={() => setEditEmoji("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] px-2 py-1 rounded transition-colors duration-150"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Crossfade settings */}
              <div className="space-y-3 pt-2 border-t border-[var(--aurora-rim)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-micro text-[10px]">Crossfade</p>
                    <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
                      Blend songs during transitions
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditCrossfadeEnabled(!editCrossfadeEnabled)}
                    role="switch"
                    aria-checked={editCrossfadeEnabled}
                    className={`relative rounded-full transition-colors duration-200 flex-shrink-0 ${
                      editCrossfadeEnabled
                        ? "bg-[var(--aurora-accent-interactive)]"
                        : "bg-white/[0.12]"
                    }`}
                    style={{ height: "22px", width: "40px" }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
                      style={{ transform: editCrossfadeEnabled ? "translateX(18px)" : "translateX(0)" }}
                    />
                  </button>
                </div>
                <div
                  className="transition-opacity duration-200"
                  style={{ opacity: editCrossfadeEnabled ? 1 : 0.35, pointerEvents: editCrossfadeEnabled ? "auto" : "none" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-[var(--aurora-text-secondary)]">Duration</span>
                    <span className="text-[12px] tabular-nums text-[var(--aurora-text)]">{editCrossfadeDuration.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={editCrossfadeDuration}
                    onChange={(e) => setEditCrossfadeDuration(Number(e.target.value))}
                    className="aurora-range w-full"
                    style={{ ["--aurora-range-pct" as string]: `${(editCrossfadeDuration / 10) * 100}%` }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--aurora-text-tertiary)]">0s</span>
                    <span className="text-[10px] text-[var(--aurora-text-tertiary)]">10s</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px]">
              Delete "{activePlaylist.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the playlist and all its songs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Remove Confirmation */}
      <AlertDialog open={bulkRemoveDialogOpen} onOpenChange={setBulkRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px]">
              Remove {selectedIds.size} song{selectedIds.size === 1 ? '' : 's'} from playlist?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You can undo this action within 5 seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Waveform Trim Editor */}
      {openTrimId !== null && activePlaylist && (() => {
        const trimSong = activePlaylist.songs.find((s) => s.id === openTrimId)
        if (!trimSong) return null
        return (
          <WaveformTrimEditor
            song={trimSong}
            open={true}
            onClose={() => setOpenTrimId(null)}
            onSaved={() => fetchPlaylistDetail(playlistId)}
          />
        )
      })()}
    </div>
  )
}

// ── Checkbox (custom, no shadcn dependency) ──

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
      className="h-4 w-4 rounded-[3px] flex items-center justify-center transition-all duration-150 aurora-focus"
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

// ── PlaylistSongRow ──

interface PlaylistSongRowProps {
  song: PlaylistSong
  index: number
  onRemove: () => void
  onPlay: (song: PlaylistSong) => void
  openTrimId: number | null
  setOpenTrimId: (id: number | null) => void
  // Multi-select
  isSelected: boolean
  onToggleSelect: (shiftKey: boolean) => void
  // Drag-and-drop
  isDragEnabled: boolean
  dragId: number | null
  dragOverId: number | null
  onDragStart: (e: React.DragEvent, songId: number) => void
  onDragOver: (e: React.DragEvent, songId: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, songId: number) => void
  onDragEnd: (e: React.DragEvent) => void
}

function PlaylistSongRow({
  song, index, onRemove, onPlay,
  openTrimId, setOpenTrimId,
  isSelected, onToggleSelect,
  isDragEnabled, dragId, dragOverId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: PlaylistSongRowProps) {
  const trimOpen = openTrimId === song.id
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const isCurrent = currentSong?.id === song.id
  const hasFile = song.file_path !== null
  const isDragging = dragId === song.id
  const isDragOver = dragOverId === song.id && dragId !== song.id

  const handlePlay = () => {
    if (!hasFile) return
    onPlay(song)
  }

  return (
    <>
    <tr
      onClick={handlePlay}
      draggable={isDragEnabled}
      onDragStart={(e) => onDragStart(e, song.id)}
      onDragOver={(e) => onDragOver(e, song.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, song.id)}
      onDragEnd={onDragEnd}
      className={`group relative transition-all duration-200 ${
        hasFile ? "cursor-pointer" : "cursor-not-allowed opacity-40"
      } ${isDragging ? "opacity-40" : ""}`}
      style={{
        ...(isDragOver ? {
          borderTop: "2px solid var(--aurora-accent-interactive)",
        } : {}),
      }}
    >
      {/* Drag handle cell */}
      {isDragEnabled && (
        <td
          className="px-1 py-3 w-6 text-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 mx-auto" />
        </td>
      )}
      {/* Checkbox cell */}
      <td className="relative px-2 py-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
        <span
          className="absolute inset-0 transition-colors duration-200 pointer-events-none"
          style={isCurrent ? {
            background: "linear-gradient(to right, rgba(94,234,212,0.06) 0%, transparent 60%)",
          } : undefined}
          aria-hidden="true"
        />
        <span className="relative z-10 flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(false)}
            ariaLabel={`Select ${song.title}`}
          />
        </span>
      </td>

      {/* # cell */}
      <td className="relative px-4 py-3 w-12 text-center">
        {isCurrent && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
            style={{
              background: "var(--aurora-accent-interactive)",
              boxShadow: "0 0 8px var(--aurora-accent-interactive-glow)",
            }}
            aria-hidden="true"
          />
        )}
        <span
          className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
            isCurrent ? "" : "group-hover:bg-white/[0.025]"
          }`}
          style={
            isCurrent
              ? {
                  background:
                    "linear-gradient(to right, rgba(94,234,212,0.06) 0%, transparent 60%)",
                }
              : undefined
          }
          aria-hidden="true"
        />
        <span className="relative z-10 flex items-center justify-center text-[var(--aurora-text-tertiary)]">
          {isCurrent ? (
            <Equalizer playing={isPlaying} />
          ) : (
            <span className="text-xs tabular-nums transition-opacity duration-150 group-hover:opacity-0">
              {index + 1}
            </span>
          )}
        </span>
        {!isCurrent && (
          <span className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <AuroraPlayButton
              variant="row"
              isPlaying={false}
              onClick={(e) => { e.stopPropagation(); handlePlay() }}
              ariaLabel={`Play ${song.title}`}
            />
          </span>
        )}
      </td>

      {/* Title cell */}
      <td className="relative px-4 py-3">
        <span
          className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
            isCurrent ? "" : "group-hover:bg-white/[0.025]"
          }`}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <AlbumArt song={song} size="sm" className="aurora-rim" />
          <div className="flex flex-col min-w-0">
            <span
              className={`truncate text-[14px] font-medium leading-tight ${
                isCurrent ? "aurora-gradient-text" : "text-[var(--aurora-text)]"
              }`}
            >
              {song.title}
            </span>
            <span className="truncate text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              {song.artist}
            </span>
          </div>
        </div>
      </td>

      {/* Duration cell */}
      <td className="relative px-4 py-3 w-28 text-[12px] text-[var(--aurora-text-secondary)] tabular-nums">
        <span
          className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
            isCurrent ? "" : "group-hover:bg-white/[0.025]"
          }`}
          aria-hidden="true"
        />
        <span className="relative z-10">
          {formatDuration(song.duration)}
          {song.file_format && <> · {song.file_format.toUpperCase()}</>}
        </span>
      </td>

      {/* Tags cell */}
      <td className="relative px-4 py-3">
        <span
          className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
            isCurrent ? "" : "group-hover:bg-white/[0.025]"
          }`}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <TagList tags={song.tags} />
        </div>
      </td>

      {/* Actions cell */}
      <td className="relative px-4 py-3 w-36">
        <span
          className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
            isCurrent ? "" : "group-hover:bg-white/[0.025]"
          }`}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <IconBtn
            label="Trim"
            active={trimOpen}
            onClick={(e) => {
              e.stopPropagation()
              setOpenTrimId(trimOpen ? null : song.id)
            }}
          >
            <Scissors className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            label="Remove"
            danger
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </td>
    </tr>
    </>
  )
}

// ── IconBtn ──

interface IconBtnProps {
  children: React.ReactNode
  label: string
  danger?: boolean
  active?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent) => void
}

function IconBtn({ children, label, danger, active, disabled, onClick }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`aurora-focus h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:pointer-events-none ${
        danger
          ? "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10"
          : active
          ? "text-[var(--aurora-accent-interactive)] bg-white/[0.04]"
          : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  )
}

// ── CrossfadeChip ──

interface CrossfadeChipProps {
  playlist: PlaylistDetailType
}

function CrossfadeChip({ playlist }: CrossfadeChipProps) {
  const globalEnabled = useSettingsStore((s) => s.crossfadeEnabled)
  const globalDuration = useSettingsStore((s) => s.crossfadeDuration)
  const updatePlaylist = usePlaylistStore((s) => s.updatePlaylist)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"inherit" | "on" | "off">(
    playlist.crossfade_enabled === null || playlist.crossfade_enabled === undefined
      ? "inherit"
      : playlist.crossfade_enabled === 0
      ? "off"
      : "on"
  )
  const [duration, setDuration] = useState(playlist.crossfade_duration_s ?? globalDuration)
  const [saving, setSaving] = useState(false)

  const resolvedDuration =
    mode === "inherit" ? globalDuration : duration

  function label() {
    if (mode === "off") return "Gapless"
    return `${resolvedDuration}s`
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updatePlaylist(playlist.id, {
        crossfade_enabled: mode === "inherit" ? null : mode === "on" ? 1 : 0,
        crossfade_duration_s: mode === "on" ? duration : null,
      })
      setOpen(false)
    } catch {
      toast.error("Failed to save crossfade settings")
    } finally {
      setSaving(false)
    }
  }

  const durPct = ((duration - 1) / 11) * 100

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-all duration-150"
        title="Crossfade settings"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{label()}</span>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-4 space-y-4"
        style={{
          background: "var(--aurora-surface-3)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
        align="end"
      >
        <p className="label-micro text-[10px] tracking-[0.15em]">Crossfade</p>

        <div className="space-y-1">
          {(["inherit", "on", "off"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors duration-150 ${
                mode === m
                  ? "bg-[var(--aurora-accent-interactive)]/15 text-[var(--aurora-accent-interactive)]"
                  : "text-[var(--aurora-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--aurora-text)]"
              }`}
            >
              {m === "inherit"
                ? `Inherit global (${globalEnabled ? globalDuration + "s" : "off"})`
                : m === "on"
                ? "On"
                : "Gapless (off)"}
            </button>
          ))}
        </div>

        {mode === "on" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--aurora-text-secondary)]">Duration</span>
              <span className="text-[12px] tabular-nums text-[var(--aurora-text)]">{duration}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="aurora-range w-full"
              style={{ ["--aurora-range-pct" as string]: `${durPct}%` }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setOpen(false)}
            className="text-[11px] px-3 py-1.5 rounded text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[11px] px-3 py-1.5 rounded bg-[var(--aurora-accent-interactive)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
