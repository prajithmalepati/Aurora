import { TagChip } from "./TagChip"

interface TagListProps {
  tags: string[]
  onRemoveTag?: (tagName: string) => void
  onTagClick?: (tagName: string) => void
}

export function TagList({ tags, onRemoveTag, onTagClick }: TagListProps) {
  if (tags.length === 0) {
    return <span className="text-[var(--aurora-text-muted)] text-sm">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <TagChip
          key={tag}
          name={tag}
          onRemove={onRemoveTag ? () => onRemoveTag(tag) : undefined}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
    </div>
  )
}