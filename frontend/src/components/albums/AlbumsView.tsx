import { useEffect, useState, useCallback } from "react"
import type { AlbumInfo, AlbumDetail, ApiResponse, Song } from "@/types"
import { usePlayerStore } from "@/stores/playerStore"
import { api, getBaseUrl, withToken } from "@/lib/api"
import { SongTable } from "@/components/songs/SongTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Disc3, Play, Shuffle, ChevronLeft, Music } from "lucide-react"

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function AlbumsView() {
  const playSong = usePlayerStore((s) => s.playSong)

  // Albums list state
  const [albums, setAlbums] = useState<AlbumInfo[]>([])
  const [albumsLoading, setAlbumsLoading] = useState(true)
  const [albumsError, setAlbumsError] = useState<string | null>(null)

  // Selected album detail state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Fetch albums on mount
  useEffect(() => {
    setAlbumsLoading(true)
    setAlbumsError(null)
    api
      .get<ApiResponse<AlbumInfo[]>>("/albums")
      .then((res) => {
        setAlbums(res.data)
        setAlbumsLoading(false)
      })
      .catch((err: Error) => {
        setAlbumsError(err.message)
        setAlbumsLoading(false)
      })
  }, [])

  // Fetch album detail
  const fetchAlbumDetail = useCallback((albumName: string) => {
    setDetailLoading(true)
    setDetailError(null)
    const encoded = encodeURIComponent(albumName)
    api
      .get<ApiResponse<AlbumDetail>>(`/albums/${encoded}`)
      .then((res) => {
        setSelectedAlbum(res.data)
        setDetailLoading(false)
      })
      .catch((err: Error) => {
        setDetailError(err.message)
        setDetailLoading(false)
      })
  }, [])

  // Play all songs in an album
  const handlePlayAlbum = useCallback(
    (albumName: string) => {
      const encoded = encodeURIComponent(albumName)
      api
        .get<ApiResponse<AlbumDetail>>(`/albums/${encoded}`)
        .then((res) => {
          const playable = res.data.songs.filter((s: Song) => s.file_path)
          if (playable.length > 0) {
            playSong(playable[0], playable)
          }
        })
        .catch(() => {})
    },
    [playSong]
  )

  // Shuffle play album
  const handleShuffleAlbum = useCallback(
    (albumName: string) => {
      const encoded = encodeURIComponent(albumName)
      api
        .get<ApiResponse<AlbumDetail>>(`/albums/${encoded}`)
        .then((res) => {
          const playable = res.data.songs.filter((s: Song) => s.file_path)
          if (playable.length > 0) {
            const shuffled = [...playable].sort(() => Math.random() - 0.5)
            playSong(shuffled[0], shuffled)
          }
        })
        .catch(() => {})
    },
    [playSong]
  )

  // Album detail view
  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        loading={detailLoading}
        error={detailError}
        onBack={() => setSelectedAlbum(null)}
        onPlaySong={playSong}
      />
    )
  }

  // Albums grid
  return (
    <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Disc3 className="h-5 w-5 text-[var(--aurora-accent-interactive)]" strokeWidth={1.5} />
        <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)]">
          Albums
        </h1>
        {!albumsLoading && (
          <span className="label-micro text-[var(--aurora-text-secondary)] ml-auto">
            {albums.length} {albums.length === 1 ? "album" : "albums"}
          </span>
        )}
      </div>

      {albumsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : albumsError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
          <p className="text-[13px] text-[var(--aurora-danger)]">{albumsError}</p>
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
          <p className="font-display-italic text-[14px] text-[var(--aurora-text-tertiary)]">
            No albums yet — add some songs to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((album) => (
            <AlbumCard
              key={`${album.album_name}-${album.album_artist}`}
              album={album}
              onClick={() => fetchAlbumDetail(album.album_name)}
              onPlay={() => handlePlayAlbum(album.album_name)}
              onShuffle={() => handleShuffleAlbum(album.album_name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── AlbumCard ──

interface AlbumCardProps {
  album: AlbumInfo
  onClick: () => void
  onPlay: () => void
  onShuffle: () => void
}

function AlbumCard({ album, onClick, onPlay, onShuffle }: AlbumCardProps) {
  const [hovered, setHovered] = useState(false)
  const coverUrl = album.cover_art_path
    ? withToken(`${getBaseUrl()}/api/album-art/${album.cover_art_path}`)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col rounded-xl overflow-hidden text-left aurora-focus cursor-pointer"
      style={{ background: "var(--aurora-surface)" }}
    >
      {/* Composited rim — opacity transition (GPU-composited, no box-shadow jank) */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl transition-opacity duration-200"
        style={{
          boxShadow: "inset 0 0 0 1px var(--aurora-rim), inset 0 1px 4px rgba(94,234,212,0.15)",
          opacity: hovered ? 1 : 0.6,
        }}
        aria-hidden
      />
      {/* Cover art */}
      <div className="relative aspect-square w-full overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.album_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              background: album.dominant_color
                ? `linear-gradient(135deg, ${album.dominant_color}40, ${album.dominant_color}20)`
                : "var(--aurora-surface-inset)",
            }}
          >
            <Disc3
              className="h-12 w-12 text-[var(--aurora-text-tertiary)]"
              strokeWidth={1}
            />
          </div>
        )}

        {/* Hover overlay with play/shuffle buttons */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlay()
            }}
            className="h-10 w-10 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-110"
            style={{
              background: "var(--aurora-accent-interactive)",
              color: "var(--aurora-slate)",
            }}
            title="Play album"
          >
            <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onShuffle()
            }}
            className="h-10 w-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm text-white transition-transform duration-150 hover:scale-110 hover:bg-white/30"
            title="Shuffle album"
          >
            <Shuffle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-medium text-[var(--aurora-text)] truncate">
          {album.album_name}
        </p>
        <p className="text-[11px] text-[var(--aurora-text-secondary)] truncate mt-0.5">
          {album.album_artist}
        </p>
        <p className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums mt-1">
          {album.song_count} {album.song_count === 1 ? "song" : "songs"}
          {album.total_duration > 0 && (
            <> · {formatDuration(album.total_duration)}</>
          )}
        </p>
      </div>
    </div>
  )
}

// ── AlbumDetail ──

interface AlbumDetailProps {
  album: AlbumDetail
  loading: boolean
  error: string | null
  onBack: () => void
  onPlaySong: (song: Song, queue: Song[]) => void
}

function AlbumDetail({ album, loading, error, onBack, onPlaySong }: AlbumDetailProps) {
  const playable = album.songs.filter((s) => s.file_path)
  const totalDuration = album.songs.reduce((acc, s) => acc + (s.duration ?? 0), 0)

  return (
    <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
          style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Albums
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[24px] leading-none tracking-tight text-[var(--aurora-text)] truncate">
            {album.album_name}
          </h1>
          <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-1">
            {album.songs.length} {album.songs.length === 1 ? "song" : "songs"}
            {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
          </p>
        </div>
        {playable.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlaySong(playable[0], playable)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text)] transition-colors duration-150"
              style={{ background: "var(--aurora-accent-interactive)", color: "var(--aurora-slate)" }}
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
              Play
            </button>
            <button
              onClick={() => {
                const shuffled = [...playable].sort(() => Math.random() - 0.5)
                onPlaySong(shuffled[0], shuffled)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
              style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
            >
              <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} />
              Shuffle
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
          <p className="text-[13px] text-[var(--aurora-danger)]">{error}</p>
        </div>
      ) : (
        <SongTable
          songs={album.songs}
          loading={false}
          error={null}
          onPlay={(song) => onPlaySong(song, album.songs)}
          showSort={false}
          disableInfiniteScroll
        />
      )}
    </div>
  )
}
