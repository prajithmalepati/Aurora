import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Song } from "@/types"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"

interface EditSongDialogProps {
  song: Song
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onEdit?: () => void
}

export function EditSongDialog({ song, open: controlledOpen, onOpenChange, onEdit }: EditSongDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [album, setAlbum] = useState(song.album ?? "")
  const [duration, setDuration] = useState<string>(song.duration?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("")
  const [addingToPlaylist, setAddingToPlaylist] = useState(false)

  const updateSong = useSongStore((state) => state.updateSong)
  const playlists = usePlaylistStore((state) => state.playlists)
  const addSongToPlaylist = usePlaylistStore((state) => state.addSongToPlaylist)

  // Reset form to current song values whenever the dialog opens
  useEffect(() => {
    if (open) {
      setTitle(song.title)
      setArtist(song.artist)
      setAlbum(song.album ?? "")
      setDuration(song.duration?.toString() ?? "")
      setError(null)
      setSelectedPlaylistId("")
    }
  }, [open, song.title, song.artist, song.album, song.duration])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !artist.trim()) {
      setError("Title and artist are required")
      return
    }

    try {
      const durationValue = duration ? parseInt(duration, 10) : undefined
      await updateSong(song.id, {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || undefined,
        duration: durationValue,
      })
      setOpen(false)
      onEdit?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
    }
  }

  const handleAddToPlaylist = async () => {
    if (!selectedPlaylistId) return
    setAddingToPlaylist(true)
    try {
      await addSongToPlaylist(parseInt(selectedPlaylistId, 10), song.id)
      setSelectedPlaylistId("")
    } catch {
      // toast already fired by store
    } finally {
      setAddingToPlaylist(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit song</DialogTitle>
            <DialogDescription>Update the song details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 pt-4">
            <div className="grid gap-2">
              <label htmlFor="edit-title" className="label-micro text-[9.5px]">
                Title <span className="text-[var(--aurora-accent-vivid)]">*</span>
              </label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-artist" className="label-micro text-[9.5px]">
                Artist <span className="text-[var(--aurora-accent-vivid)]">*</span>
              </label>
              <Input
                id="edit-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-album" className="label-micro text-[9.5px]">
                Album
              </label>
              <Input
                id="edit-album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-duration" className="label-micro text-[9.5px]">
                Duration (seconds)
              </label>
              <Input
                id="edit-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 245"
                min="0"
              />
            </div>

            {/* Add to playlist */}
            <div className="border-t border-[var(--aurora-surface-border)] pt-3 grid gap-2">
              <label className="label-micro text-[9.5px]">Add to playlist</label>
              <div className="flex gap-2">
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-[var(--aurora-muted)] bg-[var(--aurora-surface)] px-3 text-[13px] text-[var(--aurora-text)] focus:outline-none focus:ring-1 focus:ring-[var(--aurora-accent-interactive)]"
                >
                  <option value="">Select a playlist…</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji ? `${p.emoji} ` : ""}{p.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!selectedPlaylistId || addingToPlaylist}
                  onClick={handleAddToPlaylist}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[var(--aurora-danger)] text-[12px] mt-3">
              {error}
            </div>
          )}

          <DialogFooter className="pt-5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
