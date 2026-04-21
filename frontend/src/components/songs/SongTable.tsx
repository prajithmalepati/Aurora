import type { Song } from "@/types"
import { SongRow } from "./SongRow"
import { Skeleton } from "@/components/ui/skeleton"
import { Music } from "lucide-react"

interface SongTableProps {
  songs: Song[]
  loading?: boolean
  onPlay?: (song: Song, index: number) => void
  animKey?: number
}

const HEADER_CLASS =
  "px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-muted)] font-medium"

function TableHeader() {
  return (
    <thead>
      <tr>
        <th className={`${HEADER_CLASS} w-12 text-center`}>#</th>
        <th className={HEADER_CLASS}>Title</th>
        <th className={`${HEADER_CLASS} w-28 hidden lg:table-cell`}>Duration</th>
        <th className={`${HEADER_CLASS} w-40 hidden lg:table-cell`}>Playlists</th>
        <th className={`${HEADER_CLASS} max-w-[200px]`}>Tags</th>
        <th className={`${HEADER_CLASS} w-32 text-right`}>Actions</th>
      </tr>
    </thead>
  )
}

export function SongTable({ songs, loading = false, onPlay, animKey }: SongTableProps) {
  if (loading) {
    return (
      <div className="w-full overflow-auto aurora-fade-in">
        <table className="w-full border-separate border-spacing-0">
          <TableHeader />
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
        <table className="w-full border-separate border-spacing-0">
          <TableHeader />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-muted)] opacity-40" />
          <p className="font-display-italic text-[22px] text-[var(--aurora-text-muted)]">
            Nothing here yet
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            Scan a folder or add a song to begin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto aurora-fade-in">
      <table className="w-full border-separate border-spacing-0">
        <TableHeader />
        <tbody key={animKey}>
          {songs.map((song, index) => (
            <SongRow key={song.id} song={song} index={index} onPlay={onPlay} animIndex={index} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
