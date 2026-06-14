import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { Trash2, Tag as TagIcon, Pencil, ListPlus, Scissors, X, GripVertical, MoreHorizontal } from "lucide-react"
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
  // Drag-and-drop
  isDraggable?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent, songId: number) => void
  onDragOver?: (e: React.DragEvent, songId: number) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent, songId: number) => void
  onDragEnd?: (e: React.DragEvent) => void
}

export const SongRow = memo(function SongRow({
  song, index, animIndex, onPlay, isSelected, onToggleSelect,
  onRemoveFromPlaylist, onTrim,
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

        {/* Duration */}
        <td className="relative px-4 py-3 w-20 text-[12px] text-[var(--aurora-text-secondary)] tabular-nums hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10 tabular-nums whitespace-nowrap">
            {formatDuration(song.duration)}
          </span>
        </td>

        {/* Artist */}
        <td className="relative px-4 py-3 text-[13px] hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10 truncate text-[var(--aurora-text-secondary)]">
            {song.artist || "Unknown Artist"}
          </span>
        </td>

        {/* Album */}
        <td className="relative px-4 py-3 text-[13px] hidden lg:table-cell">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <span className="relative z-10 truncate text-[var(--aurora-text-secondary)]">
            {song.album || "—"}
          </span>
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
        <td className="relative px-4 py-3 w-12">
          <span
            className={`absolute inset-0 transition-colors duration-150 pointer-events-none ${
              isCurrentSong ? "" : "group-hover:bg-[var(--aurora-surface-hover)]"
            }`}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="aurora-focus h-7 w-7 rounded-md flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-colors duration-150"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={handlePlay}>
                  <span className="w-4 h-4 flex items-center justify-center text-[var(--aurora-accent)]">▶</span>
                  Play Now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAddToQueue(e as unknown as React.MouseEvent) }}>
                  <ListPlus className="h-4 w-4" />
                  {inQueue ? "Already in Queue" : "Add to Queue"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTagEditorOpen(true) }}>
                  <TagIcon className="h-4 w-4" />
                  Edit Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true) }}>
                  <Pencil className="h-4 w-4" />
                  Edit Song
                </DropdownMenuItem>
                {onTrim && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTrim() }}>
                    <Scissors className="h-4 w-4" />
                    Trim
                  </DropdownMenuItem>
                )}
                {onRemoveFromPlaylist && (
                  <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist() }}>
                    <X className="h-4 w-4" />
                    Remove from Playlist
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true) }}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            className="fixed z-50 min-w-[180px] py-1.5 rounded-lg shadow-xl border backdrop-blur-xl"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              background: "color-mix(in oklch, var(--aurora-surface) 92%, transparent)",
              borderColor: "var(--aurora-rim)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
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


