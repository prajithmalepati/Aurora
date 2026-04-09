import { useFilterStore } from "@/stores/filterStore"

interface QueryInputProps {
  error?: string | null
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

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-lg overflow-hidden transition-all duration-200 focus-within:shadow-[0_0_24px_-6px_rgba(94,234,212,0.3)]"
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
          className="w-full bg-transparent border-0 outline-none px-5 py-4 text-[16px] font-mono text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] placeholder:font-display-italic placeholder:text-[15px]"
          style={{ fontFamily: "ui-monospace, 'SF Mono', 'Menlo', monospace" }}
        />
      </div>
      {error && (
        <div className="text-[var(--aurora-danger)] text-[12px] px-1">
          {error}
        </div>
      )}
    </div>
  )
}
