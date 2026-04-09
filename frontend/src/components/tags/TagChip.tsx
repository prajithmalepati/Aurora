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
      className={`bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-0.5 rounded-full cursor-default transition-colors ${
        onClick ? "cursor-pointer hover:bg-opacity-80" : ""
      }`}
    >
      {name}
    </span>
  )

  if (onRemove) {
    return (
      <div className="flex items-center gap-1">
        {chipContent}
        <button
          onClick={handleRemove}
          className="hover:text-[var(--aurora-danger)] transition-colors"
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return chipContent
}