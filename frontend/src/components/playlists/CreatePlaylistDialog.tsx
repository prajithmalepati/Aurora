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
import { PlaylistImagePicker } from "@/components/playlists/PlaylistImagePicker"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"

// Preset color swatches — retuned to the aurora palette
const PRESET_COLORS = [
  { hex: "#5eead4", name: "teal" },
  { hex: "#86efac", name: "mint" },
  { hex: "#a78bfa", name: "violet" },
  { hex: "#7dd3fc", name: "sky" },
  { hex: "#fbbf24", name: "amber" },
  { hex: "#f87171", name: "coral" },
  { hex: "#f472b6", name: "rose" },
  { hex: "#c084fc", name: "orchid" },
]

interface CreatePlaylistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePlaylistDialog({ open, onOpenChange }: CreatePlaylistDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("")
  const [emoji, setEmoji] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
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
      const newId = await createPlaylist({
        name: name.trim(),
        color: color.trim() || undefined,
        emoji: emoji.trim() || undefined,
      })
      if (imageDataUrl?.startsWith("data:")) {
        const blob = await fetch(imageDataUrl).then((r) => r.blob())
        const ext =
          blob.type === "image/png" ? "png"
          : blob.type === "image/gif" ? "gif"
          : blob.type === "image/webp" ? "webp"
          : "jpg"
        const formData = new FormData()
        formData.append("file", blob, `image.${ext}`)
        await api.upload(`/playlists/${newId}/image`, formData)
        await usePlaylistStore.getState().fetchPlaylists()
      }
      setName("")
      setColor("")
      setEmoji("")
      setImageDataUrl(null)
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
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) {
          setName("")
          setColor("")
          setEmoji("")
          setImageDataUrl(null)
          setError(null)
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a playlist</DialogTitle>
            <DialogDescription>
              Create a new playlist to organize your songs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="label-micro text-[9.5px]">Cover</label>
              <PlaylistImagePicker
                name={name}
                imageDataUrl={imageDataUrl}
                onImageChange={setImageDataUrl}
              />
            </div>

            <div className="space-y-2">
              <label className="label-micro text-[9.5px]">Name</label>
              <Input
                type="text"
                placeholder="My Playlist"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2.5">
              <label className="label-micro text-[9.5px]">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => {
                  const isSelected = color === preset.hex
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handlePresetClick(preset.hex)}
                      className="relative w-6 h-6 rounded-full transition-transform duration-150 hover:scale-110"
                      style={{
                        backgroundColor: preset.hex,
                        boxShadow: isSelected
                          ? `0 0 0 2px var(--aurora-void), 0 0 0 3px ${preset.hex}, 0 0 14px ${preset.hex}80`
                          : `0 0 8px ${preset.hex}40`,
                      }}
                      title={preset.name}
                    />
                  )
                })}
              </div>
              <Input
                type="text"
                placeholder="Custom hex (e.g. #5eead4)"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="label-micro text-[9.5px]">Emoji</label>
              <Input
                type="text"
                placeholder="🎸"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-[12px] text-[var(--aurora-danger)]">{error}</div>
            )}
          </div>

          <DialogFooter className="pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
