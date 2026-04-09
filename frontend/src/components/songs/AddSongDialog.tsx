import { useState } from "react"
import { Plus } from "lucide-react"
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
import { useSongStore } from "@/stores/songStore"
import { toast } from "sonner"

interface AddSongDialogProps {
  onAdd?: () => void
}

export function AddSongDialog({ onAdd }: AddSongDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [artist, setArtist] = useState("")
  const [album, setAlbum] = useState("")
  const [duration, setDuration] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const createSong = useSongStore((state) => state.createSong)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !artist.trim()) {
      setError("Title and artist are required")
      return
    }

    try {
      const durationValue = duration ? parseInt(duration, 10) : undefined
      await createSong({
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || undefined,
        duration: durationValue,
      })
      setOpen(false)
      setTitle("")
      setArtist("")
      setAlbum("")
      setDuration("")
      toast.success("Song added")
      onAdd?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error(`Failed to add song: ${message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <span className="inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Song
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[var(--aurora-bg-surface)] text-[var(--aurora-text)] border-[var(--aurora-border)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Song</DialogTitle>
            <DialogDescription>
              Manually add a song to your library.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="artist">Artist *</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="album">Album</Label>
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (seconds)</Label>
              <Input
                id="duration"
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
            <Button type="submit">Add Song</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}