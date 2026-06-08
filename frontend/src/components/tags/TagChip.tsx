import { X } from "lucide-react"

interface TagChipProps {
  name: string
  onRemove?: () => void
  onClick?: () => void
}

export function TagChip({ name, onRemove, onClick }: TagChipProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove?.()
  }

  const chipContent = (
    <span
      onClick={onClick ? handleClick : undefined}
      title={onClick ? "Filter by this tag" : undefined}
      className={`aurora-chip inline-flex items-center text-[11px] font-medium tracking-wide text-[var(--aurora-text-secondary)] px-2.5 py-[2px] rounded-full transition-all duration-150 ${
        onClick
          ? "cursor-pointer hover:text-[var(--aurora-text)] hover:scale-[1.03]"
          : "cursor-default"
      }`}
    >
      {name}
    </span>
  )

  if (onRemove) {
    return (
      <div className="inline-flex items-center gap-1">
        {chipContent}
        <button
          onClick={handleRemove}
          className="text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] transition-colors duration-150"
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return chipContent
}
