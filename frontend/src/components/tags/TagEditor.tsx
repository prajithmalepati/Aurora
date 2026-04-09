import { useState, useRef, useEffect, useCallback } from "react"
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
import { toast } from "sonner"

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
      <DialogContent className="sm:max-w-md bg-[var(--aurora-bg-surface)] border-[var(--aurora-border)]">
        <DialogHeader>
          <DialogTitle>Edit tags — {songTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {currentTags.length === 0 && (
            <span className="text-sm text-[var(--aurora-text-muted)]">No tags yet</span>
          )}
          {currentTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-1 rounded-full">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-[var(--aurora-danger)]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div>
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
            placeholder="Type a tag and press Enter..."
            className="bg-[var(--aurora-bg)] border-[var(--aurora-border)]"
          />
        </div>

        {filteredTags.length > 0 && (
          <div className="max-h-[150px] overflow-y-auto border border-[var(--aurora-border)] rounded-md bg-[var(--aurora-bg)]">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => handleAddTag(tag.name)}
                className="px-3 py-2 text-sm text-[var(--aurora-text)] cursor-pointer hover:bg-[var(--aurora-bg-hover)] transition-colors"
              >
                {tag.name} <span className="text-[var(--aurora-text-muted)]">({tag.song_count})</span>
              </div>
            ))}
          </div>
        )}

        {filteredTags.length === 0 && allTags.length > 0 && currentTags.length > 0 && (
          <p className="text-xs text-[var(--aurora-text-muted)]">All tags are already assigned</p>
        )}
      </DialogContent>
    </Dialog>
  )
}