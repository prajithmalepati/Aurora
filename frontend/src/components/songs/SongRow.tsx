import type { Song } from "@/types"
import { formatDuration, formatFileSize, qualityLabel } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { Trash2, Tag as TagIcon, Pencil, ListPlus, Scissors, X, GripVertical } from "lucide-react"
import { AuroraPlayButton } from "@/components/player/AuroraPlayButton"
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
import { useState, useCallback, useRef, memo } from "react"
import { TagList } from "@/components/tags/TagList"
import { TagEditor } from "@/components/tags/TagEditor"

interface SongRowProps {
  song: Song
  index: number
  animIndex?: number
  onPlay?: (song: Song, index: number) => void
  isSelected?: boolean
  onToggleSelect?: (shiftKey: boolean) => void
  // Playlist-mode optional props
  onRemoveFromPlaylist?: () => void
  onTrim?: () => void
  trimOpen?: boolean
  // Drag-and-drop
  isDraggable?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent, songId: number) => void
  onDragOver?: (e: React.DragEvent, songId: number) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent, songId: number) => void
  onDragEnd?: (e: React.DragEvent) => void
}

function FormatBadge({ format }: { format: string | null | undefined }) {
  if (!format) return null
  const fmt = format.toLowerCase()
  const isLossless = fmt === "flac" || fmt === "m4a_alac" || fmt === "wav" || fmt === "aiff" || fmt === "wv" || fmt === "ape"
  const isHiRes = isLossless && fmt !== "m4a_alac" // ALAC is lossless but not typically hi-res
  const bg = isHiRes
    ? "bg-emerald-500/15 text-emerald-400"
    : isLossless
      ? "bg-emerald-500/10 text-emerald-300"
      : fmt === "mp3"
        ? "bg-neutral-500/15 text-neutral-400"
        : "bg-amber-500/10 text-amber-300"
  return (
    <span className={`inline-flex items-center px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider rounded ${bg}`}>
      {format.toUpperCase()}
    </span>
  )
}

export const SongRow = memo(function SongRow({
  song, index, animIndex, onPlay, isSelected, onToggleSelect,
  onRemoveFromPlaylist, onTrim, trimOpen,
  isDraggable, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: SongRowProps) {
  const deleteSong = useSongStore((state) => state.deleteSong)
  const playSong = usePlayerStore((state) => state.playSong)
  const isCurrentSong = usePlayerStore(
    (state) => state.currentSong?.id === song.id
  )
  const isCurrentlyPlaying = usePlayerStore(
    (state) => state.isPlaying && state.currentSong?.id === song.id
  )
  const inQueue = usePlayerStore(
    (state) => state.queue.some((q) => q.id === song.id)
  )
  const playNext = usePlayerStore((state) => state.playNext)
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)

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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 188)
    const y = Math.min(e.clientY, window.innerHeight - 128)
    setContextMenu({ x, y })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handlePlayNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    playNext(song)
    toast.success(`"${song.title}" will play next`)
    closeContextMenu()
  }, [song, playNext, closeContextMenu])

  const handleAddToQueue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    addToQueue(song)
    toast.success(`"${song.title}" added to queue`)
    closeContextMenu()
  }, [song, addToQueue, closeContextMenu])

  const handlePlayNow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const songs = useSongStore.getState().songs
    playSong(song, songs.length > 0 ? songs : undefined)
    closeContextMenu()
  }, [song, playSong, closeContextMenu])

  const handlePlay = () => {
    if (!song.file_path) return
    if (onPlay) {
      onPlay(song, index)
    } else {
      playSong(song)
    }
  }

  const hasFile = song.file_path !== null

  const shouldStagger = animIndex !== undefined && animIndex < 16

  return (
    <>
      <tr
        ref={rowRef}
        onClick={handlePlay}
        onContextMenu={handleContextMenu}
        draggable={!!isDraggable}
        onDragStart={isDraggable && onDragStart ? (e) => onDragStart(e, song.id) : undefined}
        onDragOver={isDraggable && onDragOver ? (e) => onDragOver(e, song.id) : undefined}
        onDragLeave={isDraggable && onDragLeave ? onDragLeave : undefined}
        onDrop={isDraggable && onDrop ? (e) => onDrop(e, song.id) : undefined}
        onDragEnd={isDraggable && onDragEnd ? onDragEnd : undefined}
        className={`group relative transition-[opacity,border-color] duration-200 ${
          hasFile ? "cursor-pointer" : "cursor-not-allowed opacity-40"
        } ${isSelected ? "bg-white/[0.04]" : ""} ${shouldStagger ? "song-row-enter" : ""} ${isDraggable && isDragOver ? "" : ""}`}
        style={{
          ...(shouldStagger ? { animationDelay: `${animIndex! * 0.02}s` } : undefined),
          ...(isDragOver ? { borderTop: "2px solid var(--aurora-accent-interactive)" } : {}),
        }}
      >
        {/* Drag handle cell (playlist mode) */}
        {isDraggable && (
          <td className="px-1 py-3 w-6 text-center cursor-grab active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 mx-auto" />
          </td>
        )}
        {/* Checkbox column (when multi-select is active) */}
        {onToggleSelect && (
          <td
            className="relative px-2 py-3 w-10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
                isCurrentSong ? "" : isSelected ? "bg-white/[0.04]" : ""
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
              <button
                type="button"
                role="checkbox"
                aria-checked={!!isSelected}
                aria-label={`Select ${song.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(e.nativeEvent.shiftKey)
                }}
                className="h-4 w-4 rounded-[3px] flex items-center justify-center transition-[color,background-color,border-color,box-shadow] duration-150 aurora-focus"
                style={{
                  background: isSelected ? "var(--aurora-accent-interactive)" : "transparent",
                  border: isSelected
                    ? "1.5px solid var(--aurora-accent-interactive)"
                    : "1.5px solid var(--aurora-text-tertiary)",
                }}
              >
                {isSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-black">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </span>
          </td>
        )}

        {/* # column / play indicator */}
        <td
          className={`relative px-4 py-3 w-12 text-center ${
            isCurrentSong ? "" : "text-[var(--aurora-text-tertiary)]"
          }`}
        >
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
              <Equalizer playing={isCurrentlyPlaying} />
            ) : (
              <span className="text-xs tabular-nums transition-opacity duration-150 group-hover:opacity-0 select-none">
                {index + 1}
              </span>
            )}
          </span>
          {/* Circular play button — inset-0 flex overlay centers it in the cell
              (avoids the td percentage-positioning bug), fades in on hover. */}
          {!isCurrentSong && (
            <span className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <AuroraPlayButton
                variant="row"
                isPlaying={false}
                onClick={(e) => { e.stopPropagation(); handlePlay() }}
                ariaLabel={`Play ${song.title}`}
              />
            </span>
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
                    ? "text-white/90"
                    : "text-[var(--aurora-text)]"
                }`}
              >
                {song.title || "Untitled"}
              </span>
              <span className="truncate text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
                {song.artist || "Unknown Artist"}
                {song.featured_artists && song.featured_artists.length > 0 && (
                  <span className="text-[var(--aurora-text-tertiary)]">
                    {" "}feat. {song.featured_artists.join(", ")}
                  </span>
                )}
              </span>
            </div>
          </div>
        </td>

        {/* Duration · Format · Quality */}
        <td className="relative px-4 py-3 w-36 text-[12px] text-[var(--aurora-text-secondary)] tabular-nums hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10 flex flex-col gap-0.5">
            <span className="tabular-nums whitespace-nowrap">
              {formatDuration(song.duration)}
            </span>
            <span className="flex items-center gap-1 flex-wrap">
              <FormatBadge format={song.file_format} />
              {qualityLabel(song) && (
                <span className="text-[10px] text-[var(--aurora-text-tertiary)] whitespace-nowrap">
                  {qualityLabel(song)}
                </span>
              )}
              {formatFileSize(song.file_size) && (
                <span className="text-[10px] text-[var(--aurora-text-tertiary)] whitespace-nowrap">
                  {formatFileSize(song.file_size)}
                </span>
              )}
            </span>
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
                        backgroundColor: "var(--aurora-accent-vivid)",
                        boxShadow: "0 0 4px var(--aurora-accent-interactive-glow)",
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
            {onTrim && (
              <IconBtn
                label="Trim"
                active={trimOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  onTrim()
                }}
              >
                <Scissors className="h-3.5 w-3.5" />
              </IconBtn>
            )}
            {onRemoveFromPlaylist && (
              <IconBtn
                label="Remove"
                danger
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFromPlaylist()
                }}
              >
                <X className="h-3.5 w-3.5" />
              </IconBtn>
            )}
            <IconBtn
              label={inQueue ? "Already in queue" : "Add to queue"}
              onClick={(e) => {
                e.stopPropagation()
                if (!inQueue) {
                  addToQueue(song)
                  toast.success(`"${song.title}" added to queue`)
                }
              }}
            >
              <ListPlus className={`h-3.5 w-3.5 ${inQueue ? "opacity-40" : ""}`} />
            </IconBtn>
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

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Click-away backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }}
          />
          <div
            className="fixed z-50 min-w-[180px] py-1.5 rounded-lg shadow-xl border"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              background: "var(--aurora-surface)",
              borderColor: "var(--aurora-rim)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={handlePlayNow}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-accent)]">
                ▶
              </span>
              Play Now
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={handlePlayNext}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-text-secondary)]">
                ↳
              </span>
              Play Next
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--aurora-text)] hover:bg-[var(--aurora-surface-hover)] transition-colors text-left"
              onClick={handleAddToQueue}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-text-secondary)]">
                <ListPlus className="h-3.5 w-3.5" />
              </span>
              {inQueue ? "Already in Queue" : "Add to Queue"}
            </button>
          </div>
        </>
      )}

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
})

interface IconBtnProps {
  children: React.ReactNode
  label: string
  danger?: boolean
  active?: boolean
  onClick: (e: React.MouseEvent) => void
}

function IconBtn({ children, label, danger, active, onClick }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`aurora-focus h-7 w-7 rounded-md flex items-center justify-center transition-[color,background-color,box-shadow,opacity] duration-150 ${
        danger
          ? "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10"
          : active
          ? "text-[var(--aurora-accent-interactive)] bg-white/[0.04]"
          : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  )
}
