import type { Song } from "@/types"
import { GripVertical } from "lucide-react"
import { useSongStore } from "@/stores/songStore"
import { usePlayerStore } from "@/stores/playerStore"
import { toast } from "@/lib/toast"
import { useState, useCallback, useRef, memo } from "react"
import { TagEditor } from "@/components/tags/TagEditor"
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
import type { ColumnDef, CellCtx } from "./columns"

interface SongRowProps {
  song: Song
  index: number
  animIndex?: number
  visibleColumns: ColumnDef[]
  onPlay?: (song: Song, index: number) => void
  isSelected?: boolean
  onToggleSelect?: (shiftKey: boolean, metaKey?: boolean) => void
  onContextMenu?: (e: React.MouseEvent) => void
  selectMode?: boolean
  // Actions from parent (context-menu parity)
  onPlayNext?: () => void
  onAddToPlaylist?: () => void
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
  song, index, animIndex, visibleColumns, onPlay, isSelected, onToggleSelect, onContextMenu: onContextMenuProp, selectMode,
  onPlayNext, onAddToPlaylist,
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
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
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

  const handleAddToQueue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    addToQueue(song)
    toast.success(`"${song.title}" added to queue`)
  }, [song, addToQueue])

  const handlePlay = (e?: React.MouseEvent) => {
    if (!song.file_path) return
    // In select mode or when ctrl/meta held, toggle selection instead of playing
    if (selectMode || e?.metaKey || e?.ctrlKey) {
      if (onToggleSelect) onToggleSelect(e?.shiftKey ?? false, e?.metaKey || e?.ctrlKey)
      return
    }
    if (onPlay) {
      onPlay(song, index)
    } else {
      playSong(song)
    }
  }

  const hasFile = song.file_path !== null
  const shouldStagger = animIndex !== undefined && animIndex < 16

  // Build cell context for registry render functions
  const cellCtx: CellCtx = {
    isCurrentSong,
    isCurrentlyPlaying,
    isSelected: !!isSelected,
    index,
    hasFile,
    selectMode: !!selectMode,
    inQueue,
    onPlay: handlePlay,
    onToggleSelect: onToggleSelect ?? (() => {}),
    onDelete: () => setDeleteDialogOpen(true),
    onAddToQueue: handleAddToQueue,
    onEditTags: () => setTagEditorOpen(true),
    onEditSong: () => setEditDialogOpen(true),
    onPlayNext,
    onAddToPlaylist,
    onTrim,
    onRemoveFromPlaylist,
  }

  return (
    <>
      <tr
        ref={rowRef}
        onClick={(e) => handlePlay(e)}
        onContextMenu={onContextMenuProp}
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
        {/* Drag handle cell (playlist mode — outside registry) */}
        {isDraggable && (
          <td className="px-1 py-2 w-6 text-center cursor-grab active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 mx-auto" />
          </td>
        )}
        {/* Checkbox column (select mode only — outside registry) */}
        {selectMode && onToggleSelect && (
          <td
            className="relative px-2 py-2 w-10 text-center"
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

        {/* Registry-driven cells */}
        {visibleColumns.map((col) => (
          <td key={col.id} className={`relative ${col.cellClassName ?? ""}`}>
            {col.render(song, cellCtx)}
          </td>
        ))}
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
})
