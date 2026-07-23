import { useEffect, useState, useCallback } from "react"
import type { SmartPlaylistDefinition, ApiResponse, Song } from "@/types"
import { usePlayerStore } from "@/stores/playerStore"
import { buildSmartPlaylistQueue } from "@/lib/smartPlaylistQueue"
import { api } from "@/lib/api"
import { SongTable } from "@/components/songs/SongTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, Play, Shuffle, AlertCircle, Pencil } from "lucide-react"
import { useSmartPlaylistStore } from "@/stores/smartPlaylistStore"
import { useFilterStore } from "@/stores/filterStore"
import { useSongStore } from "@/stores/songStore"

interface SmartPlaylistViewProps {
  playlistId: number
}

export function SmartPlaylistView({ playlistId }: SmartPlaylistViewProps) {
  const playSong = usePlayerStore((s) => s.playSong)
  const beginEditing = useSmartPlaylistStore((s) => s.beginEditing)
  const setQuery = useFilterStore((s) => s.setQuery)
  const setIsQuickTagView = useFilterStore((s) => s.setIsQuickTagView)

  const [definition, setDefinition] = useState<SmartPlaylistDefinition | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleEditInMix = useCallback(() => {
    if (!definition) return
    setQuery(definition.query)
    setIsQuickTagView(false)
    beginEditing(definition)
    useSongStore.getState().setView({ kind: "filter" })
  }, [definition, setQuery, setIsQuickTagView, beginEditing])

  // Fetch definition + resolved songs on mount / ID change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDefinition(null)
    setSongs([])

    Promise.all([
      api.get<ApiResponse<SmartPlaylistDefinition>>(`/smart-playlists/${playlistId}`),
      api.get<ApiResponse<Song[]>>(`/smart-playlists/${playlistId}/songs`),
    ])
      .then(([defRes, songsRes]) => {
        if (cancelled) return
        setDefinition(defRes.data)
        setSongs(songsRes.data)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [playlistId])

  const playable = buildSmartPlaylistQueue(songs)

  const handlePlay = useCallback(() => {
    if (playable.length > 0) {
      playSong(playable[0], playable, playlistId)
    }
  }, [playable, playSong, playlistId])

  const handleShuffle = useCallback(() => {
    if (playable.length > 0) {
      const shuffled = [...playable].sort(() => Math.random() - 0.5)
      playSong(shuffled[0], shuffled, playlistId)
    }
  }, [playable, playSong, playlistId])

  const handlePlaySong = useCallback(
    (song: Song) => {
      if (!playable.some((s) => s.id === song.id)) return
      playSong(song, playable, playlistId)
    },
    [playSong, playable, playlistId],
  )

  return (
    <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1800px] mx-auto h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-5 w-5 text-[var(--aurora-accent-interactive)]" strokeWidth={1.5} />
        <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)] truncate">
          {definition?.emoji ? `${definition.emoji} ` : ""}{definition?.name ?? "Smart Playlist"}
        </h1>
        {!loading && !error && (
          <span className="label-micro text-[var(--aurora-text-secondary)] ml-auto">
            {songs.length} {songs.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {/* Query line */}
      {definition && (
        <div className="flex items-center gap-2 mb-4">
          <code className="text-[12px] font-mono text-[var(--aurora-text-tertiary)] truncate">
            {definition.query}
          </code>
        </div>
      )}

      {/* Play / Shuffle controls */}
      {!loading && !error && playable.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handlePlay}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text)] transition-colors duration-150"
            style={{ background: "var(--aurora-accent-interactive)", color: "var(--aurora-slate)" }}
          >
            <Play className="h-3.5 w-3.5" fill="currentColor" />
            Play
          </button>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
            style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
          >
            <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} />
            Shuffle
          </button>
          {definition && (
            <button
              onClick={handleEditInMix}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
              style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              Edit in Mix
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="h-8 w-8 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
          <p className="text-[13px] text-[var(--aurora-danger)]">
            Failed to load smart playlist
          </p>
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Sparkles className="h-8 w-8 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
          <p className="font-display-italic text-[14px] text-[var(--aurora-text-tertiary)]">
            No songs match this query
          </p>
          {definition && (
            <code className="text-[12px] font-mono text-[var(--aurora-text-tertiary)]">
              {definition.query}
            </code>
          )}
          {definition && (
            <button
              onClick={handleEditInMix}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
              style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
              Edit in Mix
            </button>
          )}
        </div>
      ) : (
        <SongTable
          songs={songs}
          loading={false}
          error={null}
          onPlay={handlePlaySong}
          columnContext="all-songs"
          showSort={false}
          disableInfiniteScroll
          fillHeight
        />
      )}
    </div>
  )
}
