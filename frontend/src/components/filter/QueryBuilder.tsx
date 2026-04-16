import { useFilterStore } from "@/stores/filterStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { QueryInput } from "./QueryInput"
import { SongTable } from "@/components/songs/SongTable"
import { Search, X, Shuffle, Sparkles, SlidersHorizontal } from "lucide-react"
import type { Song } from "@/types"

const OPERATORS = ["AND", "OR", "NOT", "(", ")"] as const

export function QueryBuilder() {
  const query = useFilterStore((state) => state.query)
  const results = useFilterStore((state) => state.results)
  const error = useFilterStore((state) => state.error)
  const loading = useFilterStore((state) => state.loading)
  const appendToQuery = useFilterStore((state) => state.appendToQuery)
  const appendTerm = useFilterStore((state) => state.appendTerm)
  const executeFilter = useFilterStore((state) => state.executeFilter)
  const jamFilter = useFilterStore((state) => state.jamFilter)
  const shuffleAndJamFilter = useFilterStore((state) => state.shuffleAndJamFilter)
  const clearResults = useFilterStore((state) => state.clearResults)

  const playSong = usePlayerStore((state) => state.playSong)
  const tags = useTagStore((state) => state.tags)
  const playlists = usePlaylistStore((state) => state.playlists)

  const handlePlaySong = (song: Song) => {
    playSong(song, results)
  }

  const hasSearched = query.trim().length > 0

  return (
    <div className="p-4 sm:px-10 sm:pt-6 max-w-[1400px] mx-auto aurora-view-enter">
      {/* Row 1 — Title + action buttons */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)]">
          Mix
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={executeFilter}
            disabled={loading}
            className="mix-btn-search h-8 px-4 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 aurora-btn-press disabled:opacity-50"
          >
            <Search className="h-3 w-3" strokeWidth={2.5} />
            {loading ? "..." : "Search"}
          </button>
          <button
            onClick={jamFilter}
            disabled={loading}
            className="mix-btn-jam h-8 px-5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 aurora-btn-press disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Jam
          </button>
          <button
            onClick={shuffleAndJamFilter}
            disabled={loading}
            title="Shuffle & play"
            aria-label="Shuffle and play"
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-all duration-150 aurora-btn-press disabled:opacity-50"
            style={{
              background: "var(--aurora-surface)",
              boxShadow: "inset 0 0 0 1px var(--aurora-surface-border)",
            }}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={clearResults}
            className="h-8 px-2 text-[11px] font-medium text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] inline-flex items-center gap-1 transition-colors duration-150"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Row 2 — The Query Bar: input + chip tray in one glass container */}
      <div
        className={`rounded-lg overflow-hidden mix-query-bar ${error ? "mix-query-bar--error" : ""}`}
      >
        {/* Top: query input spanning full width */}
        <QueryInput />

        {/* Bottom: chip tray — tags | operators | playlists */}
        {(tags.length > 0 || playlists.length > 0) && (
          <div className="flex items-center border-t border-[rgba(255,255,255,0.05)] px-3 py-2 gap-1.5 overflow-x-auto aurora-chiprow">
            {/* Tag chips */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() =>
                      appendTerm(tag.name.includes(" ") ? `"${tag.name}"` : tag.name)
                    }
                    className="aurora-chip flex-shrink-0 text-[11px] font-medium text-[var(--aurora-text-secondary)] px-2.5 py-[2px] rounded-full hover:text-[var(--aurora-text)]"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            {tags.length > 0 && (
              <div className="aurora-divider-v h-5 flex-shrink-0 mx-1" />
            )}

            {/* Operator keys */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {OPERATORS.map((op) => (
                <button
                  key={op}
                  onClick={() => appendToQuery(op)}
                  className="mix-kbd"
                >
                  {op}
                </button>
              ))}
            </div>

            {/* Divider */}
            {playlists.length > 0 && (
              <div className="aurora-divider-v h-5 flex-shrink-0 mx-1" />
            )}

            {/* Playlist chips */}
            {playlists.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {playlists.map((playlist) => {
                  const color = playlist.color || "#a78bfa"
                  return (
                    <button
                      key={playlist.id}
                      onClick={() =>
                        appendTerm(
                          playlist.name.includes(" ")
                            ? `"${playlist.name}"`
                            : playlist.name.toLowerCase()
                        )
                      }
                      className="flex-shrink-0 whitespace-nowrap text-[11px] font-medium px-2.5 py-[2px] rounded-full transition-all duration-150 inline-flex items-center gap-1.5 text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
                      style={{
                        border: `1px solid ${color}30`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${color}55`
                        e.currentTarget.style.background = `${color}0a`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${color}30`
                        e.currentTarget.style.background = "transparent"
                      }}
                    >
                      <span
                        className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {playlist.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[var(--aurora-danger)] text-[11px] px-1 mt-1.5">{error}</p>
      )}

      {/* Results */}
      <div className="mt-5">
        {!hasSearched ? (
          <div className="py-16 text-center">
            <SlidersHorizontal className="h-8 w-8 mx-auto mb-4 text-[var(--aurora-text-tertiary)] opacity-50" />
            <p className="font-display-italic text-[20px] text-[var(--aurora-text-tertiary)]">
              Build a query above
            </p>
            <p className="text-[11px] text-[var(--aurora-text-tertiary)] mt-1.5">
              Click tags to combine them, then press Enter or Search
            </p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[18px] text-[var(--aurora-danger)]">
              {error}
            </p>
          </div>
        ) : loading ? (
          <SongTable songs={[]} loading={true} />
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display-italic text-[20px] text-[var(--aurora-text-tertiary)]">
              No songs match this query
            </p>
          </div>
        ) : (
          <>
            <p className="label-micro mb-3 text-[var(--aurora-text-secondary)]">
              {results.length} {results.length === 1 ? "song" : "songs"}
            </p>
            <SongTable songs={results} loading={false} onPlay={handlePlaySong} />
          </>
        )}
      </div>
    </div>
  )
}
