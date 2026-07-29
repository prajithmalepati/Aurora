import { useState, useEffect } from "react"
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
import { useSmartPlaylistStore } from "@/stores/smartPlaylistStore"
import { toast } from "@/lib/toast"

/**
 * Resolve the effective query for an edit PATCH.
 * Returns the supplied query unchanged if nonblank (after trim);
 * otherwise falls back to the stored query from the smart playlist.
 */
export function resolveEditQuery(supplied: string, stored: string): string {
  return supplied.trim() ? supplied : stored
}

/** Build the PATCH payload for updating an existing smart playlist. */
export function buildUpdatePatch(fields: {
  name: string
  color: string
  emoji: string
  query: string
}): { name: string; color: string | null; emoji: string | null; query: string } {
  return {
    name: fields.name.trim(),
    color: fields.color.trim() || null,
    emoji: fields.emoji.trim() || null,
    query: fields.query,
  }
}

// Preset color swatches — aurora palette, matching CreatePlaylistDialog
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

interface SaveSmartPlaylistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The raw query being saved or edited. */
  query: string
  /** Called after a successful create so the parent can navigate to the new view. */
  onCreated?: (definition: { id: number }) => void
}

export function SaveSmartPlaylistDialog({ open, onOpenChange, query, onCreated }: SaveSmartPlaylistDialogProps) {
  const editingSmartPlaylist = useSmartPlaylistStore((s) => s.editingSmartPlaylist)
  const createSmartPlaylist = useSmartPlaylistStore((s) => s.createSmartPlaylist)
  const updateSmartPlaylist = useSmartPlaylistStore((s) => s.updateSmartPlaylist)

  const isEditing = editingSmartPlaylist !== null
  const effectiveQuery = isEditing ? resolveEditQuery(query, editingSmartPlaylist.query) : query

  const [name, setName] = useState("")
  const [color, setColor] = useState("")
  const [emoji, setEmoji] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pre-fill when opening for edit
  useEffect(() => {
    if (open && isEditing) {
      setName(editingSmartPlaylist.name)
      setColor(editingSmartPlaylist.color ?? "")
      setEmoji(editingSmartPlaylist.emoji ?? "")
      setError(null)
    } else if (open && !isEditing) {
      setName("")
      setColor("")
      setEmoji("")
      setError(null)
    }
  }, [open, isEditing, editingSmartPlaylist])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    setSubmitting(true)
    try {
      if (isEditing) {
        await updateSmartPlaylist(editingSmartPlaylist.id, buildUpdatePatch({ name, color, emoji, query: effectiveQuery }))
        toast.success("Smart playlist updated")
        onOpenChange(false)
      } else {
        const created = await createSmartPlaylist({
          name: name.trim(),
          color: color.trim() || undefined,
          emoji: emoji.trim() || undefined,
          query,
        })
        toast.success("Smart playlist created")
        onOpenChange(false)
        onCreated?.(created)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save"
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setName("")
      setColor("")
      setEmoji("")
      setError(null)
    }
  }

  const handlePresetClick = (hex: string) => {
    setColor(hex)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit smart playlist" : "Save mix"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the name, color, emoji, or query for this smart playlist."
                : "Give this query a name to save it as a smart playlist."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="label-micro text-[9.5px]">Name</label>
              <Input
                type="text"
                placeholder="My smart playlist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
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

            {/* Read-only query display */}
            <div className="space-y-2">
              <label className="label-micro text-[9.5px]">Query</label>
              <div className="rounded-md px-3 py-2 text-[12px] font-mono text-[var(--aurora-text-tertiary)] break-all" style={{ background: "var(--aurora-surface)" }}>
                {effectiveQuery}
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-[var(--aurora-danger)]">{error}</div>
            )}
          </div>

          <DialogFooter className="pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
