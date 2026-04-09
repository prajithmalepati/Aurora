import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "sonner"

// Preset color swatches
const PRESET_COLORS = [
  { hex: "#E63946", name: "red" },
  { hex: "#00C9A7", name: "teal" },
  { hex: "#7B68EE", name: "purple" },
  { hex: "#F59E0B", name: "amber" },
  { hex: "#00E676", name: "green" },
  { hex: "#4FC3F7", name: "blue" },
  { hex: "#FF6B35", name: "orange" },
  { hex: "#EC4899", name: "pink" },
]

interface CreatePlaylistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePlaylistDialog({ open, onOpenChange }: CreatePlaylistDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("")
  const [emoji, setEmoji] = useState("")
  const [error, setError] = useState<string | null>(null)

  const createPlaylist = usePlaylistStore((state) => state.createPlaylist)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    try {
      await createPlaylist({
        name: name.trim(),
        color: color.trim() || undefined,
        emoji: emoji.trim() || undefined,
      })
      toast.success("Playlist created")
      setName("")
      setColor("")
      setEmoji("")
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create playlist"
      setError(message)
      toast.error(message)
    }
  }

  const handlePresetClick = (hex: string) => {
    setColor(hex)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        setName("")
        setColor("")
        setEmoji("")
      setError(null)
      }
    }}>
      <DialogContent className="bg-[var(--aurora-bg-surface)] border-[var(--aurora-border)] text-[var(--aurora-text)] shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
            <DialogDescription className="text-[var(--aurora-text-dim)]">
              Create a new playlist to organize your songs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-[var(--aurora-text-dim)]">Name</label>
              <Input
                type="text"
                placeholder="My Playlist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[var(--aurora-text-dim)]">Color (optional)</label>
              {/* Preset color swatches */}
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => handlePresetClick(preset.hex)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === preset.hex
                        ? "border-[var(--aurora-teal)] ring-2 ring-[var(--aurora-teal)]/30"
                        : "border-[var(--aurora-border)]"
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  />
                ))}
              </div>
              {/* Custom hex input */}
              <Input
                type="text"
                placeholder="Custom color (hex)"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[var(--aurora-text-dim)]">Emoji (optional)</label>
              <Input
                type="text"
                placeholder="🎸"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              />
            </div>

            {error && (
              <div className="text-sm text-[var(--aurora-danger)]">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[var(--aurora-text-dim)]"
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-[var(--aurora-teal)] text-[var(--aurora-bg-deep)]">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}