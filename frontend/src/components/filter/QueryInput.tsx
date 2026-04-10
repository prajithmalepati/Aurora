import { useFilterStore } from "@/stores/filterStore"
import { useMemo } from "react"
import { Check, X } from "lucide-react"

interface QueryInputProps {
  error?: string | null
}

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

export function QueryInput({ error }: QueryInputProps) {
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
    <div className="space-y-2">
      <div
        className="relative rounded-lg overflow-hidden transition-all duration-200 focus-within:shadow-[0_0_20px_-6px_rgba(94,234,212,0.2),0_0_20px_-6px_rgba(167,139,250,0.15)]"
        style={{
          background: "rgba(255,255,255,0.02)",
          boxShadow: error
            ? "inset 0 0 0 1px rgba(248, 113, 113, 0.4)"
            : "inset 0 0 0 1px var(--aurora-rim)",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="slow AND (rock OR anime) NOT sad"
          className="w-full bg-transparent border-0 outline-none pl-5 pr-12 py-4 text-[16px] font-mono text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] placeholder:font-display-italic placeholder:text-[15px]"
          style={{ fontFamily: "ui-monospace, 'SF Mono', 'Menlo', monospace" }}
        />
        {showIndicator && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            {isValid ? (
              <Check className="h-4 w-4 text-[var(--aurora-mint)]" strokeWidth={2.5} />
            ) : (
              <X className="h-4 w-4 text-[var(--aurora-danger)]" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>
      {error && (
        <div className="text-[var(--aurora-danger)] text-[12px] px-1">
          {error}
        </div>
      )}
    </div>
  )
}
