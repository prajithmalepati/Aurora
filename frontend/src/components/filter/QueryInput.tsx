import { useFilterStore } from "@/stores/filterStore"
import { Input } from "@/components/ui/input"

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
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a query like: slow AND (rock OR anime)"
        className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)] h-12 text-base font-mono"
      />
      {error && (
        <div className="text-[var(--aurora-danger)] text-sm">
          {error}
        </div>
      )}
    </div>
  )
}