import { useSongStore } from "@/stores/songStore"
import type { Song } from "@/types"
import { SongRow } from "./SongRow"
import { Skeleton } from "@/components/ui/skeleton"
import { Music, ChevronUp, ChevronDown } from "lucide-react"

interface SongTableProps {
  songs: Song[]
  loading?: boolean
  onPlay?: (song: Song, index: number) => void
  animKey?: number
  showSort?: boolean
}

const HEADER_CLASS =
  "px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] font-medium"

type SortField = "title" | "artist" | "album" | "duration" | "created_at"

interface TableHeaderProps {
  sortField: SortField
  sortOrder: "asc" | "desc"
  onSort: (field: SortField) => void
}

function TableHeader({ sortField, sortOrder, onSort }: TableHeaderProps) {
  const SortArrow = sortOrder === "asc" ? ChevronUp : ChevronDown

  function SortableTh({
    field,
    label,
    className,
  }: {
    field: SortField
    label: string
    className?: string
  }) {
    const active = sortField === field
    return (
      <th
        className={`${HEADER_CLASS} cursor-pointer select-none hover:text-[var(--aurora-text-secondary)] ${active ? "text-[var(--aurora-text-secondary)]" : ""} ${className ?? ""}`}
        onClick={() => onSort(field)}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active && <SortArrow className="h-2.5 w-2.5" />}
        </span>
      </th>
    )
  }

  return (
    <thead>
      <tr>
        <th className={`${HEADER_CLASS} w-12 text-center`}>#</th>
        <SortableTh field="title" label="Title" />
        <SortableTh field="duration" label="Duration" className="w-28 hidden lg:table-cell" />
        <th className={`${HEADER_CLASS} w-40 hidden lg:table-cell`}>Playlists</th>
        <th className={`${HEADER_CLASS} max-w-[200px]`}>Tags</th>
        <th className={`${HEADER_CLASS} w-32 text-right`}>Actions</th>
      </tr>
    </thead>
  )
}

export function SongTable({ songs, loading = false, onPlay, animKey, showSort = true }: SongTableProps) {
  const sortField = useSongStore((state) => state.sortField)
  const sortOrder = useSongStore((state) => state.sortOrder)
  const sortSongs = useSongStore((state) => state.sortSongs)

  function handleColumnSort(field: SortField) {
    if (field === sortField) {
      sortSongs(field, sortOrder === "asc" ? "desc" : "asc")
    } else {
      sortSongs(field, "asc")
    }
  }

  function handleDropdownChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [field, order] = e.target.value.split("-") as [SortField, "asc" | "desc"]
    sortSongs(field, order)
  }

  const sortDropdownValue = `${sortField}-${sortOrder}`

  const toolbar = showSort ? (
    <div className="flex items-center justify-end px-4 pb-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--aurora-text-tertiary)] uppercase tracking-wide">Sort</span>
        <select
          value={sortDropdownValue}
          onChange={handleDropdownChange}
          className="text-[11px] bg-transparent text-[var(--aurora-text-secondary)] border border-[var(--aurora-rim)] rounded px-2 py-1 focus:outline-none cursor-pointer hover:border-[var(--aurora-muted)]"
        >
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="artist-asc">Artist A–Z</option>
          <option value="artist-desc">Artist Z–A</option>
          <option value="album-asc">Album A–Z</option>
          <option value="album-desc">Album Z–A</option>
          <option value="duration-asc">Duration ↑</option>
          <option value="duration-desc">Duration ↓</option>
          <option value="created_at-desc">Newest first</option>
          <option value="created_at-asc">Oldest first</option>
        </select>
      </div>
    </div>
  ) : null

  if (loading) {
    return (
      <div className="w-full overflow-auto aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Skeleton className="h-3 w-10" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Skeleton className="h-3 w-20" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="w-full aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)] opacity-40" />
          <p className="font-display-italic text-[22px] text-[var(--aurora-text-tertiary)]">
            Nothing here yet
          </p>
          <p className="text-xs text-[var(--aurora-text-tertiary)]">
            Scan a folder or add a song to begin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto aurora-fade-in">
      {toolbar}
      <table className="w-full border-separate border-spacing-0">
        <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
        <tbody key={animKey}>
          {songs.map((song, index) => (
            <SongRow key={song.id} song={song} index={index} onPlay={onPlay} animIndex={index} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
