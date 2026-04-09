import { useFilterStore } from "@/stores/filterStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { QueryInput } from "./QueryInput"
import { Button } from "@/components/ui/button"
import { SongTable } from "@/components/songs/SongTable"

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

  const handleOperatorClick = (operator: string) => () => {
    appendToQuery(operator)
  }

  const handleTagClick = (tagName: string) => () => {
    if (tagName.includes(" ")) {
      appendToQuery(`"${tagName}"`)
    } else {
      appendToQuery(tagName)
    }
  }

  const handlePlaylistClick = (playlistName: string) => () => {
    appendToQuery(playlistName.toLowerCase())
  }

  const hasSearched = query.trim().length > 0

  return (
    <div className="p-4 space-y-4">
      <QueryInput error={error} />

      {/* Operator buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOperatorClick("AND")}
          className="font-bold"
        >
          AND
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOperatorClick("OR")}
          className="font-bold"
        >
          OR
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOperatorClick("NOT")}
          className="font-bold"
        >
          NOT
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOperatorClick("(")}
          className="font-bold"
        >
          (
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOperatorClick(")")}
          className="font-bold"
        >
          )
        </Button>
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={handleTagClick(tag.name)}
              className="bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-opacity-80"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Playlist chips */}
      {playlists.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={handlePlaylistClick(playlist.name)}
              className="text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-opacity-80"
              style={{
                border: `1px solid ${playlist.color || "var(--aurora-teal)"}`,
                color: playlist.color || "var(--aurora-teal)",
              }}
            >
              {playlist.name}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={executeFilter}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </Button>
        <Button
          variant="secondary"
          onClick={clearResults}
        >
          Clear
        </Button>
      </div>

      {/* Results */}
      <div className="mt-4">
        {!hasSearched ? (
          <div className="text-[var(--aurora-text-muted)] text-center py-8">
            Build a query above and click Search
          </div>
        ) : error ? (
          <div className="text-[var(--aurora-danger)] text-center py-8">
            {error}
          </div>
        ) : results.length === 0 ? (
          <div className="text-[var(--aurora-text-muted)] text-center py-8">
            No songs match this query
          </div>
        ) : (
          <SongTable songs={results} loading={loading} />
        )}
      </div>
    </div>
  )
}