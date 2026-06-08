import { TagChip } from "./TagChip"
import { useState } from "react"

interface TagListProps {
  tags: string[]
  maxVisible?: number
  onRemoveTag?: (tagName: string) => void
  onTagClick?: (tagName: string) => void
}

export function TagList({ tags, maxVisible = 3, onRemoveTag, onTagClick }: TagListProps) {
  const [expanded, setExpanded] = useState(false)

  if (tags.length === 0) {
    return <span className="text-[var(--aurora-text-tertiary)] text-[12px]">—</span>
  }

  const showAll = expanded || tags.length <= maxVisible
  const visible = showAll ? tags : tags.slice(0, maxVisible - 1)
  const remaining = tags.length - visible.length

  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {visible.map((tag) => (
        <TagChip
          key={tag}
          name={tag}
          onRemove={onRemoveTag ? () => onRemoveTag(tag) : undefined}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          className="aurora-chip inline-flex items-center text-[11px] font-medium tracking-wide text-[var(--aurora-text-tertiary)] px-2.5 py-[2px] rounded-full transition-all duration-150 hover:text-[var(--aurora-text)] cursor-pointer"
        >
          +{remaining} more
        </button>
      )}
    </div>
  )
}
