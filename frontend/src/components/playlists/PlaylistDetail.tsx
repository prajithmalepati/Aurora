import { useEffect, useState, useMemo, useCallback } from "react"
import type { PlaylistSong, PlaylistDetail as PlaylistDetailType } from "@/types"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useSongStore } from "@/stores/songStore"
import { usePlayerStore } from "@/stores/playerStore"

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
import { Pencil, Trash2, Search, Sparkles, ArrowLeft, AlertTriangle, Download, Plus } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSettingsStore } from "@/stores/settingsStore"
import { Skeleton } from "@/components/ui/skeleton"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { PlaylistImagePicker } from "@/components/playlists/PlaylistImagePicker"
import { WaveformTrimEditor } from "@/components/player/WaveformTrimEditor"
import { api, BASE_URL, dataUrlToBlob, getBaseUrl, getAuroraToken, withToken } from "@/lib/api"
import { SongTable } from "@/components/songs/SongTable"
import type { Song } from "@/types"

function playlistSongToSong(ps: PlaylistSong): Song {
  return {
    ...ps,
    source: "local",
    playlists: [],
    created_at: "",
    updated_at: "",
  }
}

interface PlaylistDetailProps {
  playlistId: number
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylistDetail = usePlaylistStore((state) => state.fetchPlaylistDetail)
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist)
  const removeSongFromPlaylist = usePlaylistStore((state) => state.removeSongFromPlaylist)
  const reorderSongs = usePlaylistStore((state) => state.reorderSongs)
  const addSongToPlaylist = usePlaylistStore((state) => state.addSongToPlaylist)

  const playSong = usePlayerStore((state) => state.playSong)
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
  const [addSongSearch, setAddSongSearch] = useState("")
  const [addSongOpen, setAddSongOpen] = useState(false)
  const [sortField] = useState<'position'|'title'|'artist'|'album'|'duration'>('position')
  const [sortOrder] = useState<'asc'|'desc'>('asc')

  // Drag state removed — now handled by dnd-kit in SongTable

  useEffect(() => {
    fetchPlaylistDetail(playlistId)
  }, [playlistId, fetchPlaylistDetail])

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

  const songsForTable = useMemo(() => sortedSongs.map(playlistSongToSong), [sortedSongs])

  // ── Add song to playlist search ──
  const allSongs = useSongStore((s) => s.songs)
  const fetchSongs = useSongStore((s) => s.fetchSongs)
  const addSongResults = useMemo(() => {
    const q = addSongSearch.trim().toLowerCase()
    if (!q) return []
    const playlistSongIds = new Set(activePlaylist?.songs.map((s) => s.id) ?? [])
    return allSongs
      .filter((s) => !playlistSongIds.has(s.id))
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.artist ?? "").toLowerCase().includes(q) ||
          (s.album ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [addSongSearch, allSongs, activePlaylist])

  const handleAddSongToPlaylist = async (songId: number) => {
    if (!activePlaylist) return
    try {
      await addSongToPlaylist(activePlaylist.id, songId)
      setAddSongSearch("")
    } catch {
      // toast is already in store
    }
  }

  // Fallback: procedural gradient from playlist identity
  const fallbackGlow = useMemo(
    () => albumGradient(activePlaylist?.songs[0]?.id?.toString() ?? activePlaylist?.name ?? `playlist-${playlistId}`).glow,
    [activePlaylist?.songs, activePlaylist?.name, playlistId]
  )

  // Server-stored image URL (comes back from the API on every fetchPlaylistDetail)
  const heroImage = activePlaylist?.image_url ? withToken(`${getBaseUrl()}${activePlaylist.image_url}`) : null

  // Use backend-computed dominant_color (same as songs) — no client canvas extraction.
  const heroGlow = activePlaylist?.dominant_color ?? fallbackGlow

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
      const response = await fetch(`${BASE_URL}/playlists/${activePlaylist.id}/export?format=${format}`, { headers: { "X-Aurora-Token": getAuroraToken() ?? "" } })
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
      setEditImageDataUrl(activePlaylist.image_url ? withToken(`${getBaseUrl()}${activePlaylist.image_url}`) : null)
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
        const blob = dataUrlToBlob(editImageDataUrl)
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

  // ── Single song remove ──

  const handleRemoveSong = async (song: PlaylistSong) => {
    if (!activePlaylist) return
    try {
      await removeSongFromPlaylist(activePlaylist.id, song.id)
      toast.success("Song removed from playlist")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove song"
      toast.error(message)
    }
  }

  // ── Drag-and-drop (dnd-kit) ──

  const isDragEnabled = sortField === 'position'

  const handleReorder = useCallback(async (fromId: number, toId: number) => {
    if (!activePlaylist || fromId === toId || !isDragEnabled) return

    const songs = activePlaylist.songs
    const fromIndex = songs.findIndex(s => s.id === fromId)
    const toIndex = songs.findIndex(s => s.id === toId)
    if (fromIndex === -1 || toIndex === -1) return

    // Compute new order
    const newSongs = [...songs]
    const [moved] = newSongs.splice(fromIndex, 1)
    newSongs.splice(toIndex, 0, moved)
    const newOrderedIds = newSongs.map(s => s.id)

    // Optimistic update
    usePlaylistStore.setState({
      activePlaylist: { ...activePlaylist, songs: newSongs }
    })

    try {
      await reorderSongs(activePlaylist.id, newOrderedIds)
    } catch (err: unknown) {
      // Revert on failure
      const message = err instanceof Error ? err.message : "Failed to reorder songs"
      toast.error(message)
      fetchPlaylistDetail(activePlaylist.id)
    }
  }, [activePlaylist, isDragEnabled, reorderSongs, fetchPlaylistDetail])

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
      <div className="relative px-4 pt-6 pb-6 sm:px-10 sm:pt-10 sm:pb-8 overflow-hidden">
        {/* Background halo derived from playlist art */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 700px 400px at 18% 0%, ${heroGlow} 0%, transparent 65%)`,
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-end gap-4 sm:gap-7">
          {/* Hero art tile */}
          <div
            className="w-[96px] h-[96px] sm:w-[168px] sm:h-[168px] rounded-xl flex-shrink-0 aurora-rim overflow-hidden flex items-center justify-center text-3xl sm:text-5xl"
            style={{
              background: heroImage || showArtGrid ? undefined : heroTileGradient,
              boxShadow: `0 20px 60px -20px ${heroGlow}, inset 0 0 0 1px var(--aurora-rim)`,
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
          <div className="flex-1 min-w-[180px] pb-2">
            <p className="label-micro mb-3 tracking-[0.2em]">Playlist</p>
            <h1 className="font-display text-[28px] sm:text-[44px] lg:text-[64px] leading-[0.95] tracking-tight text-[var(--aurora-text)] truncate">
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
                className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-[color,background-color] duration-150"
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
            <Popover open={addSongOpen} onOpenChange={(open) => {
              setAddSongOpen(open)
              if (open && allSongs.length === 0) fetchSongs()
            }}>
              <PopoverTrigger
                title="Add song to playlist"
                aria-label="Add song to playlist"
                className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-[color,background-color] duration-150"
              >
                <Plus className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search songs to add..."
                      value={addSongSearch}
                      onChange={(e) => setAddSongSearch(e.target.value)}
                      className="w-full bg-white/[0.04] border border-[var(--aurora-rim)] rounded-md pl-8 pr-3 py-1.5 text-[12px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic outline-none focus:border-[var(--aurora-accent-interactive)]/50"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {addSongSearch.trim() === "" ? (
                    <p className="px-3 py-4 text-[11px] text-[var(--aurora-text-tertiary)] text-center font-display-italic">
                      Type to search your library...
                    </p>
                  ) : addSongResults.length === 0 ? (
                    <p className="px-3 py-4 text-[11px] text-[var(--aurora-text-tertiary)] text-center font-display-italic">
                      No matching songs found
                    </p>
                  ) : (
                    addSongResults.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => handleAddSongToPlaylist(song.id)}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-white/[0.04] transition-colors flex flex-col gap-0.5"
                      >
                        <span className="text-[var(--aurora-text)] font-medium truncate">{song.title}</span>
                        <span className="text-[10px] text-[var(--aurora-text-tertiary)] truncate">
                          {song.artist ?? "Unknown artist"}{song.album ? ` · ${song.album}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <button
              onClick={handleEdit}
              title="Edit playlist"
              aria-label="Edit playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-[color,background-color] duration-150"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete playlist"
              aria-label="Delete playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-[color,background-color] duration-150"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fade divider before song list */}
      <div className="aurora-divider-h mx-4 sm:mx-10" />

      {/* ── SONG LIST ── */}
      <div className="px-6 py-4">
        {activePlaylist.songs.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div
              className="search-shell relative flex-1 flex items-center rounded-full transition-[box-shadow] duration-200"
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
          </div>
        )}
        <SongTable
            columnContext="playlist"
          songs={songsForTable}
          loading={false}
          error={null}
          disableInfiniteScroll
          showSort
          onPlay={(_song, index) => {
            const ps = sortedSongs[index]
            if (ps) handlePlaySong(ps)
          }}
          onRemoveFromPlaylist={(song) => {
            const ps = activePlaylist?.songs.find((s) => s.id === song.id)
            if (ps) handleRemoveSong(ps)
          }}
          onTrim={(songId) => setOpenTrimId(openTrimId === songId ? null : songId)}
          isDraggable={isDragEnabled}
          onReorder={handleReorder}
        />
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

      {/* Waveform Trim Editor */}
      {openTrimId !== null && activePlaylist && (() => {
        const trimSong = activePlaylist.songs.find((s) => s.id === openTrimId)
        if (!trimSong) return null
        return (
          <WaveformTrimEditor
            song={trimSong}
            playlistId={playlistId}
            open={true}
            onClose={() => setOpenTrimId(null)}
            onSaved={(startMs, endMs) =>
              usePlaylistStore.getState().updateSongTiming(trimSong.id, startMs, endMs)
            }
          />
        )
      })()}
    </div>
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
        className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-[color,background-color] duration-150"
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
