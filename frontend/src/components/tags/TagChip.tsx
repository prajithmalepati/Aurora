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
      className={`inline-flex items-center text-[10.5px] font-medium tracking-wide text-[var(--aurora-teal)] px-2 py-[2px] rounded-full transition-all duration-150 ${
        onClick ? "cursor-pointer hover:text-[#7ef2dd]" : "cursor-default"
      }`}
      style={{
        boxShadow: "inset 0 0 0 1px rgba(94, 234, 212, 0.22)",
        background: "rgba(94, 234, 212, 0.04)",
      }}
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
          className="text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] transition-colors duration-150"
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return chipContent
}
