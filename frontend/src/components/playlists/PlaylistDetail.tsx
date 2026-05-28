import { useEffect, useState, useMemo } from "react"
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
import { Pencil, Trash2, ChevronUp, ChevronDown, X, Play, Search, Scissors, Sparkles, ArrowUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSettingsStore } from "@/stores/settingsStore"
import { TagList } from "@/components/tags/TagList"
import { Skeleton } from "@/components/ui/skeleton"
import { Equalizer } from "@/components/ui/Equalizer"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { PlaylistImagePicker } from "@/components/playlists/PlaylistImagePicker"
import { api } from "@/lib/api"

interface PlaylistDetailProps {
  playlistId: number
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylistDetail = usePlaylistStore((state) => state.fetchPlaylistDetail)
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist)
  const removeSongFromPlaylist = usePlaylistStore((state) => state.removeSongFromPlaylist)
  const reorderSongs = usePlaylistStore((state) => state.reorderSongs)

  const playSong = usePlayerStore((state) => state.playSong)
  const activePlaylist = usePlaylistStore((state) => state.activePlaylist)
  const loading = usePlaylistStore((state) => state.loading)

  const [openTrimId, setOpenTrimId] = useState<number | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editEmoji, setEditEmoji] = useState("")
  const [editImageDataUrl, setEditImageDataUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<'position'|'title'|'artist'|'album'|'duration'>('position')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')

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

  const heroArt = useMemo(
    () => albumGradient(activePlaylist?.songs[0]?.id?.toString() ?? activePlaylist?.name ?? `playlist-${playlistId}`),
    [activePlaylist?.songs, activePlaylist?.name, playlistId]
  )

  // Server-stored image URL (comes back from the API on every fetchPlaylistDetail)
  const heroImage = activePlaylist?.image_url ?? null

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

  const handleEdit = () => {
    if (activePlaylist) {
      setEditName(activePlaylist.name)
      setEditColor(activePlaylist.color || "")
      setEditEmoji(activePlaylist.emoji || "")
      // Seed picker with the current server URL (displays as <img src>)
      setEditImageDataUrl(activePlaylist.image_url || null)
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

  const handleRemoveSong = async (songId: number) => {
    if (!activePlaylist) return
    try {
      await removeSongFromPlaylist(activePlaylist.id, songId)
      toast.success("Song removed from playlist")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove song"
      toast.error(message)
    }
  }

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

  const handleReorder = async (songId: number, direction: "up" | "down") => {
    if (!activePlaylist) return
    const songs = activePlaylist.songs
    const currentIndex = songs.findIndex((s) => s.id === songId)
    if (currentIndex === -1) return

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= songs.length) return

    const newSongIds = songs.map((s) => s.id)
    ;[newSongIds[currentIndex], newSongIds[newIndex]] = [
      newSongIds[newIndex],
      newSongIds[currentIndex],
    ]

    try {
      await reorderSongs(activePlaylist.id, newSongIds)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reorder songs"
      toast.error(message)
    }
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
              className="relative flex-1 flex items-center rounded-full transition-all duration-200 focus-within:shadow-[0_0_20px_-6px_var(--aurora-glow)]"
              style={{
                background: "var(--aurora-surface)",
                boxShadow: "inset 0 0 0 1px var(--aurora-surface-border)",
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
                className="w-full bg-transparent border-0 outline-none pl-11 pr-5 py-2.5 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic placeholder:text-[14px]"
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
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  )
                })}
              </PopoverContent>
            </Popover>
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
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] w-12 text-center">
                  #
                </th>
                <th
                  className={`px-4 py-3 text-left label-micro text-[10px] cursor-pointer select-none transition-colors duration-150 hover:text-[var(--aurora-text-secondary)] ${sortField === 'title' ? 'text-[var(--aurora-text)]' : 'text-[var(--aurora-text-tertiary)]'}`}
                  onClick={() => sortField === 'title' ? setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') : (setSortField('title'), setSortOrder('asc'))}
                >
                  <span className="inline-flex items-center gap-1">Title{sortField === 'title' && (sortOrder === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</span>
                </th>
                <th
                  className={`px-4 py-3 text-left label-micro text-[10px] w-24 cursor-pointer select-none transition-colors duration-150 hover:text-[var(--aurora-text-secondary)] ${sortField === 'duration' ? 'text-[var(--aurora-text)]' : 'text-[var(--aurora-text-tertiary)]'}`}
                  onClick={() => sortField === 'duration' ? setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') : (setSortField('duration'), setSortOrder('asc'))}
                >
                  <span className="inline-flex items-center gap-1">Duration{sortField === 'duration' && (sortOrder === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</span>
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
                    total={activePlaylist.songs.length}
                    onRemove={() => handleRemoveSong(song.id)}
                    onReorder={(direction) => handleReorder(song.id, direction)}
                    onPlay={handlePlaySong}
                    openTrimId={openTrimId}
                    setOpenTrimId={setOpenTrimId}
                    playlistId={playlistId}
                    onRefresh={() => fetchPlaylistDetail(playlistId)}
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
    </div>
  )
}

interface PlaylistSongRowProps {
  song: PlaylistSong
  index: number
  total: number
  onRemove: () => void
  onReorder: (direction: "up" | "down") => void
  onPlay: (song: PlaylistSong) => void
  openTrimId: number | null
  setOpenTrimId: (id: number | null) => void
  playlistId: number
  onRefresh: () => void
}

function PlaylistSongRow({ song, index, total, onRemove, onReorder, onPlay, openTrimId, setOpenTrimId, playlistId, onRefresh }: PlaylistSongRowProps) {
  const trimOpen = openTrimId === song.id
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const isCurrent = currentSong?.id === song.id
  const hasFile = song.file_path !== null

  const handlePlay = () => {
    if (!hasFile) return
    onPlay(song)
  }

  return (
    <>
    <tr
      onClick={handlePlay}
      className={`group relative transition-colors duration-200 ${
        hasFile ? "cursor-pointer" : "cursor-not-allowed opacity-40"
      }`}
    >
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
            <>
              <span className="text-xs tabular-nums group-hover:hidden">
                {index + 1}
              </span>
              <Play
                className="h-3.5 w-3.5 hidden group-hover:block text-[var(--aurora-text)]"
                fill="currentColor"
                strokeWidth={0}
              />
            </>
          )}
        </span>
      </td>

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
            label="Move up"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation()
              onReorder("up")
            }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            label="Move down"
            disabled={index === total - 1}
            onClick={(e) => {
              e.stopPropagation()
              onReorder("down")
            }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
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
    {trimOpen && (
      <TrimPanel
        song={song}
        playlistId={playlistId}
        onClose={() => setOpenTrimId(null)}
        onSaved={onRefresh}
      />
    )}
    </>
  )
}

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

interface TrimPanelProps {
  song: PlaylistSong
  playlistId: number
  onClose: () => void
  onSaved: () => void
}

function TrimPanel({ song, playlistId, onClose, onSaved }: TrimPanelProps) {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const seek = usePlayerStore((s) => s.seek)

  const durationMs = (song.duration ?? 0) * 1000
  const isCurrent = currentSong?.id === song.id

  const [startMs, setStartMs] = useState(song.start_time_ms ?? 0)
  const [endMs, setEndMs] = useState(
    song.end_time_ms && song.end_time_ms > 0 ? song.end_time_ms : durationMs
  )
  const [saving, setSaving] = useState(false)
  const [editingStart, setEditingStart] = useState(false)
  const [editingEnd, setEditingEnd] = useState(false)
  const [startText, setStartText] = useState("")
  const [endText, setEndText] = useState("")

  const isInvalid = startMs > 0 && endMs > 0 && startMs >= endMs
  const seekMs = seek * 1000
  const startPct = durationMs > 0 ? (startMs / durationMs) * 100 : 0
  const endPct = durationMs > 0 ? (endMs / durationMs) * 100 : 100
  const seekPct = durationMs > 0 ? Math.min((seekMs / durationMs) * 100, 100) : 0

  function msToMSS(ms: number) {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  }

  function parseMSS(text: string): number | null {
    const m = text.match(/^(\d+):(\d{2})$/)
    if (!m) return null
    return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000
  }

  async function handleSave() {
    if (isInvalid) return
    setSaving(true)
    try {
      await api.patch(`/playlists/${playlistId}/songs/${song.id}/timing`, {
        start_time_ms: startMs,
        end_time_ms: endMs === durationMs ? endMs : endMs,
      })
      toast.success("Trim saved")
      onSaved()
      onClose()
    } catch {
      toast.error("Failed to save trim")
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      await api.patch(`/playlists/${playlistId}/songs/${song.id}/timing`, {
        start_time_ms: 0,
        end_time_ms: 0,
      })
      toast.success("Trim reset")
      onSaved()
      onClose()
    } catch {
      toast.error("Failed to reset trim")
      setSaving(false)
    }
  }

  return (
    <tr>
      <td
        colSpan={5}
        className="px-6 pb-3 aurora-fade-in"
        style={{ background: "var(--aurora-surface)", borderTop: "1px solid var(--aurora-rim)" }}
      >
        <div className="space-y-3 pt-3">
          {/* Visual zone bar */}
          <div className="relative h-5 flex items-center">
            <div
              className="absolute inset-x-0 h-1.5 rounded-full"
              style={{
                background: `linear-gradient(to right,
                  rgba(255,255,255,0.08) 0%,
                  rgba(255,255,255,0.08) ${startPct}%,
                  var(--aurora-accent-interactive) ${startPct}%,
                  var(--aurora-accent-interactive) ${endPct}%,
                  rgba(255,255,255,0.08) ${endPct}%,
                  rgba(255,255,255,0.08) 100%
                )`,
              }}
            />
            {isCurrent && (
              <div
                className="absolute w-2 h-2 rounded-full bg-white -translate-x-1/2 z-10"
                style={{
                  left: `${seekPct}%`,
                  boxShadow: "0 0 6px 2px rgba(255,255,255,0.5)",
                }}
              />
            )}
          </div>

          {/* Start slider */}
          <div className="flex items-center gap-3">
            <span className="label-micro w-10 text-right shrink-0">Start</span>
            <input
              type="range"
              min={0}
              max={durationMs || 100}
              step={1000}
              value={startMs}
              onChange={(e) =>
                setStartMs(Math.min(Number(e.target.value), endMs > 1000 ? endMs - 1000 : 0))
              }
              className="aurora-range flex-1"
              style={{ ["--aurora-range-pct" as string]: `${startPct}%` }}
            />
            {editingStart ? (
              <input
                type="text"
                value={startText}
                autoFocus
                onChange={(e) => setStartText(e.target.value)}
                onBlur={() => {
                  const parsed = parseMSS(startText)
                  if (parsed !== null) setStartMs(Math.min(parsed, endMs - 1000))
                  setEditingStart(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") setEditingStart(false)
                }}
                className="w-14 text-center text-[12px] bg-[var(--aurora-surface-3)] border border-[var(--aurora-rim)] rounded px-1 py-0.5 text-[var(--aurora-text)] outline-none"
              />
            ) : (
              <button
                onClick={() => { setStartText(msToMSS(startMs)); setEditingStart(true) }}
                className="w-14 text-center text-[12px] tabular-nums text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors"
              >
                {msToMSS(startMs)}
              </button>
            )}
          </div>

          {/* End slider */}
          <div className="flex items-center gap-3">
            <span className="label-micro w-10 text-right shrink-0">End</span>
            <input
              type="range"
              min={0}
              max={durationMs || 100}
              step={1000}
              value={endMs}
              onChange={(e) =>
                setEndMs(Math.max(Number(e.target.value), startMs + 1000))
              }
              className="aurora-range flex-1"
              style={{ ["--aurora-range-pct" as string]: `${endPct}%` }}
            />
            {editingEnd ? (
              <input
                type="text"
                value={endText}
                autoFocus
                onChange={(e) => setEndText(e.target.value)}
                onBlur={() => {
                  const parsed = parseMSS(endText)
                  if (parsed !== null) setEndMs(Math.max(parsed, startMs + 1000))
                  setEditingEnd(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                  if (e.key === "Escape") setEditingEnd(false)
                }}
                className="w-14 text-center text-[12px] bg-[var(--aurora-surface-3)] border border-[var(--aurora-rim)] rounded px-1 py-0.5 text-[var(--aurora-text)] outline-none"
              />
            ) : (
              <button
                onClick={() => { setEndText(msToMSS(endMs)); setEditingEnd(true) }}
                className="w-14 text-center text-[12px] tabular-nums text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors"
              >
                {msToMSS(endMs)}
              </button>
            )}
          </div>

          {isInvalid && (
            <p className="text-[11px] text-[var(--aurora-danger)] pl-16">
              Start must be before end
            </p>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1 pl-16">
            <button
              onClick={() => setStartMs(Math.floor(seekMs / 1000) * 1000)}
              disabled={!isCurrent}
              title={isCurrent ? undefined : "Play song first"}
              className="text-[11px] px-2.5 py-1 rounded border border-[var(--aurora-rim)] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:border-[var(--aurora-accent-interactive)] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"
            >
              Mark In
            </button>
            <button
              onClick={() => setEndMs(Math.floor(seekMs / 1000) * 1000)}
              disabled={!isCurrent}
              title={isCurrent ? undefined : "Play song first"}
              className="text-[11px] px-2.5 py-1 rounded border border-[var(--aurora-rim)] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:border-[var(--aurora-accent-interactive)] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"
            >
              Mark Out
            </button>
            <span className="flex-1" />
            <button
              onClick={handleReset}
              disabled={saving}
              className="text-[11px] px-2.5 py-1 rounded text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] transition-colors duration-150 disabled:opacity-30"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isInvalid}
              className="text-[11px] px-3 py-1 rounded bg-[var(--aurora-accent-interactive)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

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
