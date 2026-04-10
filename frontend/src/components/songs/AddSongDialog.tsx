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
import { useSongStore } from "@/stores/songStore"
import { toast } from "sonner"

interface AddSongDialogProps {
  onAdd?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddSongDialog({ onAdd, open: controlledOpen, onOpenChange }: AddSongDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
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
      {controlledOpen === undefined && (
        <DialogTrigger render={<Button variant="primary" />}>
          <span className="inline-flex items-center">
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={2.5} />
            Add Song
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a song</DialogTitle>
            <DialogDescription>
              Manually add a song to your library.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 pt-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="label-micro text-[9.5px]">
                Title <span className="text-[var(--aurora-teal)]">*</span>
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="artist" className="label-micro text-[9.5px]">
                Artist <span className="text-[var(--aurora-teal)]">*</span>
              </label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="album" className="label-micro text-[9.5px]">
                Album
              </label>
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="duration" className="label-micro text-[9.5px]">
                Duration (seconds)
              </label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 245"
                min="0"
              />
            </div>
          </div>

          {error && (
            <div className="text-[var(--aurora-danger)] text-[12px] mt-3">
              {error}
            </div>
          )}

          <DialogFooter className="pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Song
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
