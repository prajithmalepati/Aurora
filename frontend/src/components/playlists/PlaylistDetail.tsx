import { useEffect, useState } from "react"
import type { PlaylistDetail, PlaylistSong } from "@/types"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useSongStore } from "@/stores/songStore"
import { formatDuration } from "@/lib/utils"
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
import { toast } from "sonner"
import { Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react"
import { TagList } from "@/components/tags/TagList"
import { Skeleton } from "@/components/ui/skeleton"

interface PlaylistDetailProps {
  playlistId: number
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylistDetail = usePlaylistStore((state) => state.fetchPlaylistDetail)
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist)
  const removeSongFromPlaylist = usePlaylistStore((state) => state.removeSongFromPlaylist)
  const reorderSongs = usePlaylistStore((state) => state.reorderSongs)

  const activePlaylist = usePlaylistStore((state) => state.activePlaylist)
  const loading = usePlaylistStore((state) => state.loading)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editEmoji, setEditEmoji] = useState("")

  useEffect(() => {
    fetchPlaylistDetail(playlistId)
  }, [playlistId, fetchPlaylistDetail])

  const handleEdit = () => {
    if (activePlaylist) {
      setEditName(activePlaylist.name)
      setEditColor(activePlaylist.color || "")
      setEditEmoji(activePlaylist.emoji || "")
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
      await playlistStore.updatePlaylist(activePlaylist.id, {
        name: editName.trim(),
        color: editColor.trim() || undefined,
        emoji: editEmoji.trim() || undefined,
      })
      toast.success("Playlist updated")
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

  const handleReorder = async (songId: number, direction: "up" | "down") => {
    if (!activePlaylist) return
    const songs = activePlaylist.songs
    const currentIndex = songs.findIndex((s) => s.id === songId)
    if (currentIndex === -1) return

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= songs.length) return

    const newSongIds = songs.map((s) => s.id)
    ;[newSongIds[currentIndex], newSongIds[newIndex]] = [newSongIds[newIndex], newSongIds[currentIndex]]

    try {
      await reorderSongs(activePlaylist.id, newSongIds)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reorder songs"
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2 mt-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!activePlaylist) {
    return (
      <div className="p-6">
        <span className="text-[var(--aurora-text-muted)]">Playlist not found</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {activePlaylist.emoji && (
            <span className="text-3xl">{activePlaylist.emoji}</span>
          )}
          <div>
            <h1 className="text-2xl font-[Outfit] text-[var(--aurora-text)]">
              {activePlaylist.name}
            </h1>
            <span className="text-sm text-[var(--aurora-text-dim)]">
              {activePlaylist.songs.length} songs
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            className="h-8 w-8 text-[var(--aurora-text-dim)]"
            title="Edit playlist"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
            className="h-8 w-8 text-[var(--aurora-danger)] hover:text-[var(--aurora-danger)]"
            title="Delete playlist"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Song list */}
      <div className="w-full overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--aurora-border)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Title / Artist
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {activePlaylist.songs.map((song, index) => (
              <PlaylistSongRow
                key={song.id}
                song={song}
                index={index}
                onRemove={() => handleRemoveSong(song.id)}
                onReorder={(direction) => handleReorder(song.id, direction)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] text-[var(--aurora-text)]">
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
            <DialogHeader>
              <DialogTitle>Edit Playlist</DialogTitle>
              <DialogDescription className="text-[var(--aurora-text-dim)]">
                Update your playlist details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-[var(--aurora-text-dim)]">Name</label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[var(--aurora-text-dim)]">Color (optional)</label>
                <Input
                  type="text"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="#00C9A7"
                  className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[var(--aurora-text-dim)]">Emoji (optional)</label>
                <Input
                  type="text"
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  placeholder="🎸"
                  className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditDialogOpen(false)}
                className="text-[var(--aurora-text-dim)]"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[var(--aurora-teal)] text-[var(--aurora-bg-deep)]">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] text-[var(--aurora-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{activePlaylist.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--aurora-text-dim)]">
              This will remove the playlist and all its songs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[var(--aurora-text-dim)]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[var(--aurora-danger)]"
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
  onRemove: () => void
  onReorder: (direction: "up" | "down") => void
}

function PlaylistSongRow({ song, index, onRemove, onReorder }: PlaylistSongRowProps) {
  return (
    <tr className="bg-[var(--aurora-bg)] border-b border-[var(--aurora-border)] hover:bg-[var(--aurora-bg-hover)] transition-colors duration-150">
      {/* # column */}
      <td className="px-4 py-3 text-[var(--aurora-text-dim)] text-sm">
        {index + 1}
      </td>

      {/* Title / Artist column */}
      <td className="px-4 py-3">
        <div className="font-medium text-[var(--aurora-text)]">{song.title}</div>
        <div className="text-sm text-[var(--aurora-text-dim)]">{song.artist}</div>
      </td>

      {/* Duration column */}
      <td className="px-4 py-3 text-[var(--aurora-text-dim)] text-sm">
        {formatDuration(song.duration)}
      </td>

      {/* Tags column */}
      <td className="px-4 py-3">
        <TagList tags={song.tags} />
      </td>

      {/* Actions column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onReorder("up")
            }}
            disabled={index === 0}
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onReorder("down")
            }}
            disabled={index === 0}
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--aurora-danger)] hover:text-[var(--aurora-danger)]"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            title="Remove from playlist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}