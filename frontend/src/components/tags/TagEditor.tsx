import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSongStore } from "@/stores/songStore"
import { useTagStore } from "@/stores/tagStore"
import { toast } from "@/lib/toast"

interface TagEditorProps {
  songId: number
  songTitle: string
  currentTags: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagEditor({ songId, songTitle, currentTags, open, onOpenChange }: TagEditorProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const assignTags = useSongStore((s) => s.assignTags)
  const removeTag = useSongStore((s) => s.removeTag)
  const allTags = useTagStore((s) => s.tags)
  const fetchTags = useTagStore((s) => s.fetchTags)

  useEffect(() => {
    if (open) {
      fetchTags()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, fetchTags])

  const currentTagSet = new Set(currentTags)
  const filteredTags = allTags
    .filter((t) => !currentTagSet.has(t.name))
    .filter((t) => !inputValue || t.name.toLowerCase().includes(inputValue.toLowerCase()))

  const handleAddTag = async (name: string) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    try {
      await assignTags(songId, [trimmed])
      await fetchTags()
      setInputValue("")
      toast.success(`Tag "${trimmed}" added`)
    } catch {
      toast.error("Failed to add tag")
    }
  }

  const handleRemoveTag = async (tagName: string) => {
    const tag = allTags.find((t) => t.name === tagName)
    if (!tag) return
    try {
      await removeTag(songId, tag.id)
      await fetchTags()
      toast.success(`Tag "${tagName}" removed`)
    } catch {
      toast.error("Failed to remove tag")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] leading-tight">
            Edit tags
          </DialogTitle>
          <p className="text-[12px] text-[var(--aurora-text-secondary)] font-display-italic mt-0.5 truncate">
            {songTitle}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <p className="label-micro text-[9.5px] mb-2.5">Current</p>
            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {currentTags.length === 0 && (
                <span className="text-[12px] text-[var(--aurora-text-tertiary)] font-display-italic">
                  No tags yet
                </span>
              )}
              {currentTags.map((tag) => (
                <span
                  key={tag}
                  className="aurora-chip inline-flex items-center gap-1 text-[10px] font-medium text-[var(--aurora-text-secondary)] px-2 py-[1.5px] rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] transition-colors duration-150"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="aurora-divider-h" />

          <div>
            <p className="label-micro text-[9.5px] mb-2.5">Add tag</p>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  handleAddTag(inputValue)
                }
              }}
              placeholder="Type and press Enter..."
            />
          </div>

          {filteredTags.length > 0 && (
            <div
              className="max-h-[180px] overflow-y-auto rounded-md"
              style={{
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAddTag(tag.name)}
                  className="w-full px-3 py-2 text-[13px] text-[var(--aurora-text)] cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between"
                >
                  <span>{tag.name}</span>
                  <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
                    {tag.song_count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredTags.length === 0 && allTags.length > 0 && currentTags.length > 0 && (
            <p className="text-[11px] text-[var(--aurora-text-tertiary)] font-display-italic">
              All tags already assigned
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
