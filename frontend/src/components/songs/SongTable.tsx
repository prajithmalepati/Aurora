import type { Song } from "@/types"
import { SongRow } from "./SongRow"
import { Skeleton } from "@/components/ui/skeleton"

interface SongTableProps {
  songs: Song[]
  loading?: boolean
}

export function SongTable({ songs, loading = false }: SongTableProps) {
  if (loading) {
    return (
      <div className="w-full overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--aurora-border)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Title / Artist
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Playlists
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-[var(--aurora-border)]">
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-8" />
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-12" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
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
      <div className="w-full overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--aurora-border)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Title / Artist
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Playlists
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <span className="text-[var(--aurora-text-muted)]">No songs found</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--aurora-border)]">
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              Title / Artist
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              Playlists
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              Tags
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--aurora-text-dim)] uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song, index) => (
            <SongRow key={song.id} song={song} index={index} />
          ))}
        </tbody>
      </table>
    </div>
  )
}