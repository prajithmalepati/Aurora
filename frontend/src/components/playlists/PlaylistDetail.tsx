import { useEffect, useState, useMemo } from "react"
import type { PlaylistSong } from "@/types"
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
import { Pencil, Trash2, ChevronUp, ChevronDown, X, Play, Search } from "lucide-react"
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

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editEmoji, setEditEmoji] = useState("")
  const [editImageDataUrl, setEditImageDataUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

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

  const heroArt = useMemo(
    () => albumGradient(activePlaylist?.name ?? `playlist-${playlistId}`),
    [activePlaylist?.name, playlistId]
  )

  // Server-stored image URL (comes back from the API on every fetchPlaylistDetail)
  const heroImage = activePlaylist?.image_url ?? null

  // Neutral dark gradient for the hero tile — no teal/violet bias.
  // If the playlist has a custom accent colour we let a whisper of it through.
  const heroTileGradient = useMemo(() => {
    const accent = activePlaylist?.color
    return accent
      ? `linear-gradient(135deg, ${accent}22 0%, rgba(18,20,26,1) 100%)`
      : "linear-gradient(135deg, rgba(38,38,42,1) 0%, rgba(16,17,22,1) 100%)"
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
    playSong(asSong, queue)
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
        <span className="font-display-italic text-[20px] text-[var(--aurora-text-muted)]">
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
              boxShadow: `0 20px 60px -20px ${heroArt.glow}, inset 0 0 0 1px rgba(255,255,255,0.06)`,
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
            <div className="flex items-center gap-2 mt-4 text-[12px] text-[var(--aurora-text-dim)]">
              <span className="tabular-nums font-medium">
                {activePlaylist.songs.length} {activePlaylist.songs.length === 1 ? "song" : "songs"}
              </span>
              {totalDuration > 0 && (
                <>
                  <span className="text-[var(--aurora-text-muted)]">·</span>
                  <span className="tabular-nums">{formatTotal(totalDuration)}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pb-4">
            <button
              onClick={handleEdit}
              title="Edit playlist"
              aria-label="Edit playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-all duration-150"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete playlist"
              aria-label="Delete playlist"
              className="h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-all duration-150"
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
          <div
            className="relative flex items-center rounded-full mb-4 transition-all duration-200 focus-within:shadow-[0_0_20px_-6px_var(--aurora-glow)]"
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
        )}

        {activePlaylist.songs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[22px] text-[var(--aurora-text-muted)]">
              This playlist is empty
            </p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display-italic text-[18px] text-[var(--aurora-text-tertiary)]">
              No songs match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)] w-12 text-center">
                  #
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)]">
                  Title
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)] w-24">
                  Duration
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)]">
                  Tags
                </th>
                <th className="px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)] w-36 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSongs.map((song) => {
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
              <DialogDescription className="text-[var(--aurora-text-dim)]">
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] px-2 py-1 rounded transition-colors duration-150"
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
              onClick={handleDelete}
              className="bg-[var(--aurora-danger)] text-black hover:bg-[var(--aurora-danger)]/90"
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
}

function PlaylistSongRow({ song, index, total, onRemove, onReorder, onPlay }: PlaylistSongRowProps) {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const isCurrent = currentSong?.id === song.id
  const hasFile = song.file_path !== null

  const handlePlay = () => {
    if (!hasFile) return
    onPlay(song)
  }

  return (
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
              background: "var(--aurora-primary)",
              boxShadow: "0 0 8px var(--aurora-primary-glow)",
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
        <span className="relative z-10 flex items-center justify-center text-[var(--aurora-text-muted)]">
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
            <span className="truncate text-[12px] text-[var(--aurora-text-dim)] mt-0.5">
              {song.artist}
            </span>
          </div>
        </div>
      </td>

      <td className="relative px-4 py-3 w-28 text-[12px] text-[var(--aurora-text-dim)] tabular-nums">
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
  )
}

interface IconBtnProps {
  children: React.ReactNode
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: (e: React.MouseEvent) => void
}

function IconBtn({ children, label, danger, disabled, onClick }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:pointer-events-none ${
        danger
          ? "text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10"
          : "text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  )
}
