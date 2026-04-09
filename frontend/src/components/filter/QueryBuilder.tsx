import { useFilterStore } from "@/stores/filterStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { QueryInput } from "./QueryInput"
import { SongTable } from "@/components/songs/SongTable"
import { Search, X } from "lucide-react"

type OperatorKind = "AND" | "OR" | "NOT" | "(" | ")"

const OPERATOR_STYLES: Record<OperatorKind, { color: string; shadow: string }> = {
  AND: { color: "#5eead4", shadow: "rgba(94, 234, 212, 0.3)" },
  OR: { color: "#86efac", shadow: "rgba(134, 239, 172, 0.3)" },
  NOT: { color: "#f87171", shadow: "rgba(248, 113, 113, 0.3)" },
  "(": { color: "#8b95a7", shadow: "rgba(139, 149, 167, 0.15)" },
  ")": { color: "#8b95a7", shadow: "rgba(139, 149, 167, 0.15)" },
}

export function QueryBuilder() {
  const query = useFilterStore((state) => state.query)
  const results = useFilterStore((state) => state.results)
  const error = useFilterStore((state) => state.error)
  const loading = useFilterStore((state) => state.loading)
  const appendToQuery = useFilterStore((state) => state.appendToQuery)
  const executeFilter = useFilterStore((state) => state.executeFilter)
  const clearResults = useFilterStore((state) => state.clearResults)

  const tags = useTagStore((state) => state.tags)
  const playlists = usePlaylistStore((state) => state.playlists)

  const hasSearched = query.trim().length > 0

  return (
    <div className="p-10 max-w-[1400px] mx-auto aurora-fade-in">
      {/* Header */}
      <div className="mb-6">
        <p className="label-micro mb-2">Query Builder</p>
        <h1 className="font-display text-[44px] leading-[0.95] tracking-tight text-[var(--aurora-text)]">
          Find what you need.
        </h1>
      </div>

      {/* Query input */}
      <QueryInput error={error} />

      {/* Operator buttons */}
      <div className="flex gap-2 flex-wrap mt-6">
        {(["AND", "OR", "NOT", "(", ")"] as OperatorKind[]).map((op) => {
          const style = OPERATOR_STYLES[op]
          return (
            <button
              key={op}
              onClick={() => appendToQuery(op)}
              className="group relative h-8 px-3.5 rounded-md text-[11px] font-mono font-bold tracking-wider transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                color: style.color,
                background: "rgba(255,255,255,0.02)",
                boxShadow: `inset 0 0 0 1px ${style.color}40`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${style.color}80, 0 0 16px -4px ${style.shadow}`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${style.color}40`
              }}
            >
              {op}
            </button>
          )
        })}
      </div>

      {/* Tags section */}
      {tags.length > 0 && (
        <div className="mt-6">
          <p className="label-micro mb-2.5">Tags</p>
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  appendToQuery(tag.name.includes(" ") ? `"${tag.name}"` : tag.name)
                }
                className="text-[11px] font-medium text-[var(--aurora-teal)] px-2.5 py-[3px] rounded-full transition-all duration-150 hover:scale-[1.03]"
                style={{
                  boxShadow: "inset 0 0 0 1px rgba(94, 234, 212, 0.22)",
                  background: "rgba(94, 234, 212, 0.04)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "inset 0 0 0 1px rgba(94, 234, 212, 0.5), 0 0 14px -4px rgba(94, 234, 212, 0.4)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "inset 0 0 0 1px rgba(94, 234, 212, 0.22)"
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playlists section */}
      {playlists.length > 0 && (
        <div className="mt-5">
          <p className="label-micro mb-2.5">Playlists</p>
          <div className="flex gap-1.5 flex-wrap">
            {playlists.map((playlist) => {
              const color = playlist.color || "#a78bfa"
              return (
                <button
                  key={playlist.id}
                  onClick={() => appendToQuery(playlist.name.toLowerCase())}
                  className="text-[11px] font-medium px-2.5 py-[3px] rounded-full transition-all duration-150 hover:scale-[1.03] inline-flex items-center gap-1.5"
                  style={{
                    color: color,
                    boxShadow: `inset 0 0 0 1px ${color}38`,
                    background: "rgba(255,255,255,0.015)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color}80, 0 0 14px -4px ${color}66`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color}38`
                  }}
                >
                  <span
                    className="w-[5px] h-[5px] rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  {playlist.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2 mt-7">
        <button
          onClick={executeFilter}
          disabled={loading}
          className="relative h-10 px-5 rounded-md text-[13px] font-medium text-[#050608] inline-flex items-center gap-2 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          style={{
            background: "var(--aurora-gradient)",
            boxShadow: "0 0 22px -6px rgba(94, 234, 212, 0.4)",
          }}
        >
          <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
          {loading ? "Searching..." : "Search"}
        </button>
        <button
          onClick={clearResults}
          className="h-10 px-4 rounded-md text-[13px] font-medium text-[var(--aurora-text-dim)] hover:text-[var(--aurora-text)] inline-flex items-center gap-2 transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.02)",
            boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {/* Divider */}
      <div className="aurora-divider-h mt-10" />

      {/* Results */}
      <div className="mt-8">
        {!hasSearched ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[22px] text-[var(--aurora-text-muted)]">
              Build a query above
            </p>
            <p className="text-xs text-[var(--aurora-text-muted)] mt-2">
              Press Enter or click Search to execute
            </p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[20px] text-[var(--aurora-danger)]">
              {error}
            </p>
          </div>
        ) : loading ? (
          <SongTable songs={[]} loading={true} />
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[22px] text-[var(--aurora-text-muted)]">
              No songs match this query
            </p>
          </div>
        ) : (
          <>
            <p className="label-micro mb-4">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            <SongTable songs={results} loading={false} />
          </>
        )}
      </div>
    </div>
  )
}
