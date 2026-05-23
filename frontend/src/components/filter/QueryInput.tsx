import { useFilterStore } from "@/stores/filterStore"
import { useMemo } from "react"
import { Check, X } from "lucide-react"

function validateQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false

  let depth = 0
  const tokens = trimmed.match(/(".*?"|[^\s]+)/g)
  if (!tokens) return false

  const operators = new Set(["AND", "OR", "NOT"])
  let expectTerm = true

  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (upper === "(") {
      if (!expectTerm) return false
      depth++
    } else if (upper === ")") {
      if (expectTerm) return false
      depth--
      if (depth < 0) return false
    } else if (upper === "NOT") {
      if (!expectTerm) return false
    } else if (operators.has(upper)) {
      if (expectTerm) return false
      expectTerm = true
      continue
    } else {
      if (!expectTerm) return false
      expectTerm = false
      continue
    }
    if (upper === ")") {
      expectTerm = false
    }
  }

  return depth === 0 && !expectTerm
}

export function QueryInput() {
  const query = useFilterStore((state) => state.query)
  const setQuery = useFilterStore((state) => state.setQuery)
  const executeFilter = useFilterStore((state) => state.executeFilter)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeFilter()
    }
  }

  const isValid = useMemo(() => validateQuery(query), [query])
  const showIndicator = query.trim().length > 0

  return (
    <div className="relative flex-1 flex items-center min-w-0">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="slow AND (rock OR anime) NOT sad"
        className="aurora-focus w-full bg-transparent border-0 pl-4 pr-9 py-2.5 text-[14px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic placeholder:text-[13px]"
        style={{ fontFamily: "var(--font-mono)" }}
      />
      {showIndicator && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {isValid ? (
            <Check className="h-3.5 w-3.5 text-[var(--aurora-accent-interactive)]" strokeWidth={2.5} />
          ) : (
            <X className="h-3.5 w-3.5 text-[var(--aurora-danger)]" strokeWidth={2.5} />
          )}
        </span>
      )}
    </div>
  )
}
