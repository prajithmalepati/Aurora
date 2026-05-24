export type SuggestionItem =
  | { kind: "operator"; value: "AND" | "OR" | "NOT" }
  | { kind: "tag"; name: string; matchType: "prefix" | "substring" }

interface Props {
  suggestions: SuggestionItem[]
  selectedIndex: number
  onSelect: (item: SuggestionItem) => void
}

export function AutocompleteDropdown({ suggestions, selectedIndex, onSelect }: Props) {
  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-1 aurora-fade-in rounded-lg overflow-hidden
                    bg-[var(--aurora-surface-3)] border border-[var(--aurora-rim)] backdrop-blur-md">
      {suggestions.map((item, i) => {
        const isActive = i === selectedIndex
        const activeBase = isActive ? "bg-[var(--aurora-surface)]" : "hover:bg-[var(--aurora-surface)]"

        if (item.kind === "operator") {
          return (
            <div
              key={item.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              className={`relative px-3 py-1.5 cursor-pointer flex items-center gap-2 select-none ${activeBase}`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--aurora-accent-interactive)] rounded-r" />
              )}
              <span
                className="text-[11px] font-mono px-1.5 py-0.5 rounded
                           bg-[var(--aurora-surface)] border border-[var(--aurora-rim)]
                           text-[var(--aurora-accent-interactive)] font-semibold tracking-wide"
              >
                {item.value}
              </span>
            </div>
          )
        }

        return (
          <div
            key={item.name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(item)}
            className={`relative px-3 py-1.5 cursor-pointer text-[13px] select-none ${activeBase}
              ${item.matchType === "substring" ? "text-[var(--aurora-text-secondary)]" : "text-[var(--aurora-text)]"}`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--aurora-accent-interactive)] rounded-r" />
            )}
            <span className="pl-1">{item.name}</span>
          </div>
        )
      })}
    </div>
  )
}
