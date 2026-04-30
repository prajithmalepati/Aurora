import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { Trash2, Tag as TagIcon, Pencil, Play } from "lucide-react"
import { EditSongDialog } from "@/components/songs/EditSongDialog"
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
import { toast } from "@/lib/toast"
import { useState } from "react"
import { TagList } from "@/components/tags/TagList"
import { TagEditor } from "@/components/tags/TagEditor"

interface SongRowProps {
  song: Song
  index: number
  animIndex?: number
  onPlay?: (song: Song, index: number) => void
}

export function SongRow({ song, index, animIndex, onPlay }: SongRowProps) {
  const deleteSong = useSongStore((state) => state.deleteSong)
  const playSong = usePlayerStore((state) => state.playSong)
  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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

  // Stagger delay: first 16 rows get 25ms per-row delay, rest appear instantly
  const animDelay = animIndex !== undefined && animIndex < 16 ? animIndex * 25 : 0

  return (
    <>
      <tr
        onClick={handlePlay}
        className={`aurora-row-in group relative transition-colors duration-150 ${
          hasFile ? "cursor-pointer" : "cursor-not-allowed opacity-40"
        }`}
        style={{ animationDelay: `${animDelay}ms` }}
      >
        {/* # column / play indicator */}
        <td
          className={`relative px-4 py-3 w-12 text-center ${
            isCurrentSong ? "" : "text-[var(--aurora-text-tertiary)]"
          }`}
        >
          {/* Left accent bar — only on currently playing */}
          {isCurrentSong && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
              style={{
                background: "var(--aurora-accent-interactive)",
                boxShadow: "0 0 8px var(--aurora-accent-interactive-glow)",
              }}
              aria-hidden="true"
            />
          )}
          {/* Row-level hover background */}
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong
                ? ""
                : "group-hover:bg-[var(--aurora-surface-hover)]"
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
          {/* Static content (row number / equalizer) */}
          <span className="relative z-10 flex items-center justify-center">
            {isCurrentSong ? (
              <Equalizer playing={isPlaying} />
            ) : (
              <span className="text-xs tabular-nums transition-opacity duration-150 group-hover:opacity-0 select-none">
                {index + 1}
              </span>
            )}
          </span>
          {/* Circular play button — positioned in td (td has relative), fades in on hover */}
          {!isCurrentSong && (
            <button
              className="aurora-play-btn absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-105"
              onClick={(e) => { e.stopPropagation(); handlePlay() }}
              aria-label={`Play ${song.title}`}
              tabIndex={-1}
            >
              <Play className="h-4 w-4 text-white ml-[2px]" fill="currentColor" strokeWidth={0} />
            </button>
          )}
        </td>

        {/* Title / Artist + art thumbnail */}
        <td className="relative px-4 py-3">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <AlbumArt song={song} size="sm" className="aurora-rim" />
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
              <span className="truncate text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
                {song.artist}
              </span>
            </div>
          </div>
        </td>

        {/* Duration · Format */}
        <td className="relative px-4 py-3 w-28 text-[12px] text-[var(--aurora-text-secondary)] tabular-nums hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10">
            {formatDuration(song.duration)}
            {song.file_format && <> · {song.file_format.toUpperCase()}</>}
          </span>
        </td>

        {/* Playlists */}
        <td className="relative px-4 py-3 w-40 hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10">
            {song.playlists.length > 0 ? (
              <div className="flex flex-col gap-1">
                {song.playlists.slice(0, 2).map((playlist) => (
                  <span
                    key={playlist.id}
                    className="inline-flex items-center gap-1.5 text-[11px] text-[var(--aurora-text-secondary)] truncate max-w-[140px]"
                  >
                    <span
                      className="w-[5px] h-[5px] rounded-sm flex-shrink-0"
                      style={{
                        backgroundColor: playlist.color || "#5eead4",
                        boxShadow: `0 0 4px ${playlist.color || "#5eead4"}60`,
                      }}
                    />
                    {playlist.name}
                  </span>
                ))}
                {song.playlists.length > 2 && (
                  <span className="text-[10px] text-[var(--aurora-text-tertiary)] pl-3">
                    +{song.playlists.length - 2} more
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[var(--aurora-text-tertiary)] text-[12px]">—</span>
            )}
          </div>
        </td>

        {/* Tags */}
        <td className="relative px-4 py-3 max-w-[200px]">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
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
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
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
                setEditDialogOpen(true)
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
              variant="destructive"
              onClick={handleDelete}
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

      <EditSongDialog
        song={song}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
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
      className={`aurora-focus h-7 w-7 rounded-md flex items-center justify-center transition-all duration-150 ${
        danger
          ? "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10"
          : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  )
}
