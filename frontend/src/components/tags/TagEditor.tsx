import { useState, useRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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

export function TagEditor({
  songId,
  songTitle,
  currentTags,
  open,
  onOpenChange,
}: TagEditorProps) {
  const [inputValue, setInputValue] = useState("")
  const [popoverOpen, setPopoverOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const assignTags = useSongStore((state) => state.assignTags)
  const removeTag = useSongStore((state) => state.removeTag)
  const fetchTags = useTagStore((state) => state.fetchTags)
  const allTags = useTagStore((state) => state.tags)

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Get unique tag names from tagStore
  const tagNames = allTags.map((tag) => tag.name)

  // Filter tags for autocomplete: show all tags when input is empty, filter as user types
  // Also exclude tags that are already on the song
  const currentTagSet = new Set(currentTags)
  const filteredTags = tagNames
    .filter((tag) => !currentTagSet.has(tag)) // Exclude already-assigned tags
    .filter((tag) => {
      if (!inputValue) return true // Show all when input is empty
      return tag.toLowerCase().includes(inputValue.toLowerCase())
    })

  const handleAddTag = useCallback(
    async (tagName: string) => {
      if (!tagName.trim()) return

      const newTags = [tagName.trim()]
      try {
        await assignTags(songId, newTags)
        await fetchTags()
        toast.success(`Tag "${tagName}" added`)
        setInputValue("")
        onOpenChange(false)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to add tag: ${message}`)
      }
    },
    [songId, assignTags, fetchTags, onOpenChange]
  )

  const handleRemoveTag = useCallback(
    async (tagName: string) => {
      // Look up the tag ID by name
      const tag = allTags.find((t) => t.name === tagName)
      if (!tag) {
        toast.error(`Tag "${tagName}" not found`)
        return
      }

      try {
        await removeTag(songId, tag.id)
        await fetchTags()
        toast.success(`Tag "${tagName}" removed`)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to remove tag: ${message}`)
      }
    },
    [songId, removeTag, fetchTags, allTags]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault()
        handleAddTag(inputValue)
      }
    },
    [handleAddTag, inputValue]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tags — {songTitle}</DialogTitle>
          <DialogDescription>
            Add or remove tags for this song. Press Enter or comma to add a tag.
          </DialogDescription>
        </DialogHeader>

        {/* Current tags */}
        <div className="flex flex-wrap gap-2 py-2">
          {currentTags.map((tag) => (
            <div key={tag} className="flex items-center gap-1">
              <span className="bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-0.5 rounded-full">
                {tag}
              </span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-[var(--aurora-danger)] transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add tag input with autocomplete */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a tag name and press Enter..."
              className="w-full"
              onFocus={() => setPopoverOpen(true)}
            />
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command filter={(value, search) => (value.includes(search) ? 1 : 0)}>
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => {
                        handleAddTag(tag)
                        setPopoverOpen(false)
                      }}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  )
}