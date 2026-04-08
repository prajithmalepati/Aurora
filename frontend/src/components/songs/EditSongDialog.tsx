import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Song } from "@/types"
import { useSongStore } from "@/stores/songStore"
import { toast } from "sonner"

interface EditSongDialogProps {
  song: Song
  onEdit?: () => void
}

export function EditSongDialog({ song, onEdit }: EditSongDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [album, setAlbum] = useState(song.album ?? "")
  const [duration, setDuration] = useState<string>(song.duration?.toString() ?? "")
  const [error, setError] = useState<string | null>(null)
  const updateSong = useSongStore((state) => state.updateSong)

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
      toast.success("Song updated")
      onEdit?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error(`Failed to update song: ${message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[var(--aurora-bg-surface)] text-[var(--aurora-text)] border-[var(--aurora-border)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Song</DialogTitle>
            <DialogDescription>
              Update the song details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-artist">Artist *</Label>
              <Input
                id="edit-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-album">Album</Label>
              <Input
                id="edit-album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-duration">Duration (seconds)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 245"
                min="0"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>
          </div>

          {error && (
            <div className="text-[var(--aurora-danger)] text-sm mb-4">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}