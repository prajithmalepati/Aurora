import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSongStore } from "@/stores/songStore"
import { toast } from "sonner"
import { useState } from "react"
import { EditSongDialog } from "./EditSongDialog"

interface SongRowProps {
  song: Song
  index: number
}

export function SongRow({ song, index }: SongRowProps) {
  const deleteSong = useSongStore((state) => state.deleteSong)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDelete = async () => {
    setDeleteDialogOpen(false)
    try {
      await deleteSong(song.id)
      toast.success(`"${song.title}" deleted`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to delete song: ${message}`)
    }
  }

  return (
    <>
      <tr className="bg-[var(--aurora-bg)] border-b border-[var(--aurora-border)] hover:bg-[var(--aurora-bg-hover)] transition-colors duration-150">
        {/* # column */}
        <td className="px-4 py-3 text-[var(--aurora-text-dim)] text-sm">
          {index + 1}
        </td>

        {/* Title / Artist column */}
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--aurora-text)]">{song.title}</div>
          <div className="text-sm text-[var(--aurora-text-dim)]">{song.artist}</div>
        </td>

        {/* Duration column */}
        <td className="px-4 py-3 text-[var(--aurora-text-dim)] text-sm">
          {formatDuration(song.duration)}
        </td>

        {/* Playlists column */}
        <td className="px-4 py-3">
          {song.playlists.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {song.playlists.map((playlist) => (
                <span
                  key={playlist}
                  className="text-xs text-[var(--aurora-text-dim)]"
                >
                  {playlist}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[var(--aurora-text-muted)] text-sm">—</span>
          )}
        </td>

        {/* Tags column - plain text for now */}
        <td className="px-4 py-3">
          {song.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {song.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[var(--aurora-text-muted)] text-sm">—</span>
          )}
        </td>

        {/* Actions column */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <EditSongDialog song={song} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--aurora-danger)] hover:text-[var(--aurora-danger)]"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{song.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the song from all playlists and delete all its tags.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[var(--aurora-danger)]">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
