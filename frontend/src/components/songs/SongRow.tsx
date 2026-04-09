import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { albumGradient } from "@/lib/albumGradient"
import { Equalizer } from "@/components/ui/Equalizer"
import { Trash2, Tag as TagIcon, Pencil, Play } from "lucide-react"
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
import { usePlayerStore } from "@/stores/playerStore"
import { toast } from "sonner"
import { useMemo, useState } from "react"
import { TagList } from "@/components/tags/TagList"
import { TagEditor } from "@/components/tags/TagEditor"

interface SongRowProps {
  song: Song
  index: number
  onPlay?: (song: Song, index: number) => void
}

export function SongRow({ song, index, onPlay }: SongRowProps) {
  const deleteSong = useSongStore((state) => state.deleteSong)
  const playSong = usePlayerStore((state) => state.playSong)
  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)

  const art = useMemo(() => albumGradient(song.id ?? song.title), [song.id, song.title])

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

  const handlePlay = () => {
    if (!song.file_path) return
    if (onPlay) {
      onPlay(song, index)
    } else {
      playSong(song)
    }
  }

  const isCurrentSong = currentSong?.id === song.id
  const hasFile = song.file_path !== null

  return (
    <>
      <tr
        onClick={handlePlay}
        className={`group relative transition-colors duration-200 ${
          hasFile ? "cursor-pointer" : "cursor-not-allowed opacity-40"
        }`}
      >
        {/* # column / play indicator */}
        <td
          className={`relative px-4 py-3 w-12 text-center ${
            isCurrentSong ? "" : "text-[var(--aurora-text-muted)]"
          }`}
        >
          {/* Left accent bar — only on currently playing */}
          {isCurrentSong && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-7 rounded-r-full"
              style={{
                background: "linear-gradient(to bottom, #5eead4, #86efac)",
                boxShadow: "0 0 10px rgba(94, 234, 212, 0.6)",
              }}
              aria-hidden="true"
            />
          )}
          {/* Row-level hover background */}
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong
                ? ""
                : "group-hover:bg-white/[0.025]"
            }`}
            style={
              isCurrentSong
                ? {
                    background:
                      "linear-gradient(to right, rgba(94,234,212,0.06) 0%, transparent 60%)",
                  }
                : undefined
            }
            aria-hidden="true"
          />
          <span className="relative z-10 flex items-center justify-center">
            {isCurrentSong ? (
              <Equalizer playing={isPlaying} />
            ) : (
              <>
                <span className="text-xs tabular-nums group-hover:hidden">
                  {index + 1}
                </span>
                <Play
                  className="h-3.5 w-3.5 hidden group-hover:block text-[var(--aurora-text)]"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </>
            )}
          </span>
        </td>

        {/* Title / Artist + art thumbnail */}
        <td className="relative px-4 py-3">
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-white/[0.025]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-md flex-shrink-0 aurora-rim"
              style={{ background: art.background }}
              aria-hidden="true"
            />
            <div className="flex flex-col min-w-0">
              <span
                className={`truncate text-[14px] font-medium leading-tight ${
                  isCurrentSong
                    ? "aurora-gradient-text"
                    : "text-[var(--aurora-text)]"
                }`}
              >
                {song.title}
              </span>
              <span className="truncate text-[12px] text-[var(--aurora-text-dim)] mt-0.5">
                {song.artist}
              </span>
            </div>
          </div>
        </td>

        {/* Duration */}
        <td className="relative px-4 py-3 w-24 text-[12px] text-[var(--aurora-text-dim)] tabular-nums">
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-white/[0.025]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10">{formatDuration(song.duration)}</span>
        </td>

        {/* Playlists */}
        <td className="relative px-4 py-3 w-48">
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-white/[0.025]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10">
            {song.playlists.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {song.playlists.slice(0, 2).map((playlist) => (
                  <span
                    key={playlist.id}
                    className="text-[11px] text-[var(--aurora-text-dim)] truncate max-w-[100px]"
                  >
                    {playlist.name}
                  </span>
                ))}
                {song.playlists.length > 2 && (
                  <span className="text-[11px] text-[var(--aurora-text-muted)]">
                    +{song.playlists.length - 2}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[var(--aurora-text-muted)] text-[12px]">—</span>
            )}
          </div>
        </td>

        {/* Tags */}
        <td className="relative px-4 py-3">
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-white/[0.025]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <TagList tags={song.tags} />
          </div>
        </td>

        {/* Actions */}
        <td className="relative px-4 py-3 w-32">
          <span
            className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-white/[0.025]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <IconBtn
              label="Edit tags"
              onClick={(e) => {
                e.stopPropagation()
                setTagEditorOpen(true)
              }}
            >
              <TagIcon className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              label="Edit song"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              label="Delete"
              danger
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </td>
      </tr>

      {/* Delete confirmation */}
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[var(--aurora-danger)] text-black hover:bg-[var(--aurora-danger)]/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TagEditor
        songId={song.id}
        songTitle={song.title}
        currentTags={song.tags}
        open={tagEditorOpen}
        onOpenChange={setTagEditorOpen}
      />
    </>
  )
}

interface IconBtnProps {
  children: React.ReactNode
  label: string
  danger?: boolean
  onClick: (e: React.MouseEvent) => void
}

function IconBtn({ children, label, danger, onClick }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 ${
        danger
          ? "text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10"
          : "text-[var(--aurora-text-muted)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  )
}
