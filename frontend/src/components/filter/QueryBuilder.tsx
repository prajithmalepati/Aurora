import { useRef, useEffect, useState } from "react"
import { useFilterStore } from "@/stores/filterStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { QueryInput } from "./QueryInput"
import { AutocompleteDropdown, type SuggestionItem } from "./AutocompleteDropdown"
import { SongTable } from "@/components/songs/SongTable"
import { Search, X, Shuffle, Sparkles, SlidersHorizontal, Tag } from "lucide-react"
import type { Song } from "@/types"

const OPERATORS = ["AND", "OR", "NOT", "(", ")"] as const

export function QueryBuilder() {
  const query = useFilterStore((state) => state.query)
  const results = useFilterStore((state) => state.results)
  const resultsVersion = useFilterStore((state) => state.resultsVersion)
  const error = useFilterStore((state) => state.error)
  const loading = useFilterStore((state) => state.loading)
  const isQuickTagView = useFilterStore((state) => state.isQuickTagView)
  const quickTagEditorOpen = useFilterStore((state) => state.quickTagEditorOpen)
  const appendToQuery = useFilterStore((state) => state.appendToQuery)
  const appendTerm = useFilterStore((state) => state.appendTerm)
  const executeFilter = useFilterStore((state) => state.executeFilter)
  const jamFilter = useFilterStore((state) => state.jamFilter)
  const shuffleAndJamFilter = useFilterStore((state) => state.shuffleAndJamFilter)
  const clearResults = useFilterStore((state) => state.clearResults)
  const setQuickTagEditorOpen = useFilterStore((state) => state.setQuickTagEditorOpen)

  const playSong = usePlayerStore((state) => state.playSong)
  const tags = useTagStore((state) => state.tags)
  const playlists = usePlaylistStore((state) => state.playlists)

  // Autocomplete state lifted from QueryInput so it can render in-flow
  const [dropdownItems, setDropdownItems] = useState<SuggestionItem[]>([])
  const [dropdownShow, setDropdownShow] = useState(false)
  const [dropdownIdx, setDropdownIdx] = useState(-1)
  const dropdownAcceptRef = useRef<(item: SuggestionItem) => void>(() => {})

  function handleDropdownChange(
    items: SuggestionItem[],
    show: boolean,
    accept: (item: SuggestionItem) => void,
    idx: number
  ) {
    dropdownAcceptRef.current = accept
    setDropdownItems(items)
    setDropdownShow(show)
    setDropdownIdx(idx)
  }

  // Floating action zone: appears once user scrolls past the query bar
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [showFloat, setShowFloat] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowFloat(!entry.isIntersecting),
      { threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handlePlaySong = (song: Song) => {
    playSong(song, results)
  }

  const hasSearched = query.trim().length > 0

  // Strip surrounding quotes to get a clean display name for the compact header.
  const displayTagName = query.replace(/^"|"$/g, "").trim()

  /* ── COMPACT HEADER (quick-tag mode, editor hidden) ─────────────────────── */
  if (isQuickTagView && !quickTagEditorOpen) {
    return (
      <div className="p-4 sm:px-10 sm:pt-6 max-w-[1400px] mx-auto aurora-view-enter">
        <div className="flex items-center justify-between mb-5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Tag
              className="h-[18px] w-[18px] flex-shrink-0"
              style={{ color: "var(--aurora-accent-interactive)" }}
              strokeWidth={2}
            />
            <span className="font-display text-[26px] leading-none tracking-tight text-[var(--aurora-text)] truncate">
              {displayTagName}
            </span>
            {!loading && results.length > 0 && (
              <span className="text-[14px] text-[var(--aurora-text-tertiary)] mt-[3px] flex-shrink-0">
                · {results.length} {results.length === 1 ? "song" : "songs"}
              </span>
            )}
            {loading && (
              <span className="text-[13px] text-[var(--aurora-text-tertiary)] mt-[3px] flex-shrink-0">
                …
              </span>
            )}
          </div>

          <button
            onClick={() => setQuickTagEditorOpen(true)}
            className="h-8 px-4 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 transition-colors duration-150 aurora-btn-press hover:text-[var(--aurora-text)]"
            style={{
              background: "var(--aurora-surface)",
              boxShadow: "inset 0 0 0 1px var(--aurora-surface-border)",
              color: "var(--aurora-text-secondary)",
            }}
          >
            <SlidersHorizontal className="h-3 w-3" strokeWidth={2} />
            Edit query
          </button>
        </div>

        {/* Results */}
        <div>
          {loading ? (
            <SongTable songs={[]} loading={true} showSort={false} />
          ) : error ? (
            <div className="py-16 text-center">
              <p className="font-display-italic text-[18px] text-[var(--aurora-danger)]">{error}</p>
            </div>
          ) : results.length === 0 ? (
            <MixEmptyState />
          ) : (
            <SongTable songs={results} loading={false} onPlay={handlePlaySong} animKey={resultsVersion} showSort={false} />
          )}
        </div>
      </div>
    )
  }

  /* ── FULL QUERY BUILDER (manual mode or after "Edit query") ─────────────── */
  return (
    <div className="p-4 sm:px-10 sm:pt-6 max-w-[1400px] mx-auto aurora-view-enter">
      {/* Row 1 — Title + compact action buttons (Search, Shuffle, Clear) */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)]">
          Mix
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={executeFilter}
            disabled={loading}
            className="mix-btn-search h-8 px-4 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 aurora-btn-press disabled:opacity-[0.55]"
          >
            <Search className="h-3 w-3" strokeWidth={2.5} />
            {loading ? "..." : "Search"}
          </button>
          <button
            onClick={shuffleAndJamFilter}
            disabled={loading}
            title="Shuffle & play"
            aria-label="Shuffle and play"
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 aurora-btn-press disabled:opacity-[0.55]"
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
        <QueryInput onDropdownChange={handleDropdownChange} />

        {/* In-flow autocomplete — slides chip tray down when suggestions present */}
        <div
          style={{
            maxHeight: dropdownShow && dropdownItems.length > 0
              ? `${dropdownItems.length * 34 + 8}px`
              : "0px",
            overflow: "hidden",
            transition: "max-height 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
        >
          <AutocompleteDropdown
            suggestions={dropdownItems}
            selectedIndex={dropdownIdx}
            onSelect={(item) => dropdownAcceptRef.current(item)}
          />
        </div>

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
                      className="flex-shrink-0 whitespace-nowrap text-[11px] font-medium px-2.5 py-[2px] rounded-full transition-colors duration-150 inline-flex items-center gap-1.5 text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
                      style={{
                        border: `1px solid ${color}30`,
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

      {/* Row 3 — Primary Jam button (inline, between query bar and results) */}
      <div className="flex items-center justify-end mt-4">
        <button
          onClick={jamFilter}
          disabled={loading || !query.trim()}
          className="mix-jam-primary aurora-btn-press"
        >
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
          <span className="font-display text-[18px] font-medium leading-none">Jam</span>
        </button>
      </div>

      {/* Sentinel — IntersectionObserver watches this to trigger floating zone */}
      <div ref={sentinelRef} aria-hidden />

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
          <SongTable songs={[]} loading={true} showSort={false} />
        ) : results.length === 0 ? (
          <MixEmptyState />
        ) : (
          <>
            <p className="label-micro mb-3 text-[var(--aurora-text-secondary)]">
              {results.length} {results.length === 1 ? "song" : "songs"}
            </p>
            <SongTable songs={results} loading={false} onPlay={handlePlaySong} animKey={resultsVersion} showSort={false} />
          </>
        )}
      </div>

      {/* Floating action zone — fades in once user scrolls past the query bar */}
      <div
        className={`mix-float-zone${showFloat ? " mix-float-zone--visible" : ""}`}
        aria-hidden={!showFloat}
      >
        <button
          onClick={executeFilter}
          disabled={loading || !query.trim()}
          className="mix-float-search aurora-btn-press"
        >
          <Search className="h-3 w-3" strokeWidth={2.5} />
          {loading ? "…" : "Search"}
        </button>
        <button
          onClick={jamFilter}
          disabled={loading || !query.trim()}
          className="mix-float-jam aurora-btn-press"
        >
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
          <span className="font-display text-[18px] font-medium leading-none">Jam</span>
        </button>
      </div>
    </div>
  )
}

/* ── Empty state for Mix (0 results after search) ──────────────────────── */
function MixEmptyState() {
  return (
    <div className="py-16 flex flex-col items-center gap-4">
      {/* Aurora wave SVG — abstract, no external assets */}
      <svg
        width="96"
        height="52"
        viewBox="0 0 96 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 38 C18 14, 30 42, 48 26 C66 10, 78 44, 92 20"
          stroke="rgba(77,184,164,0.30)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M4 44 C20 22, 32 48, 48 34 C64 20, 76 48, 92 28"
          stroke="rgba(138,117,200,0.22)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M4 30 C16 8, 28 36, 48 18 C68 2, 80 38, 92 12"
          stroke="rgba(77,184,164,0.14)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <div className="text-center">
        <p className="font-display-italic text-[22px] text-[var(--aurora-text-secondary)]">
          No songs match this query
        </p>
        <p className="text-[12px] text-[var(--aurora-text-tertiary)] mt-2">
          Try relaxing a filter, or combine fewer tags
        </p>
      </div>
    </div>
  )
}
