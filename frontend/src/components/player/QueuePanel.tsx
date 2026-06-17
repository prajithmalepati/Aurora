import { createPortal } from "react-dom"
import { usePlayerStore } from "@/stores/playerStore"
import type { Song } from "@/types"
import { formatDuration } from "@/lib/utils"
import { AlbumArt } from "@/components/songs/AlbumArt"
import { Equalizer } from "@/components/ui/Equalizer"
import { X, GripVertical, ListMusic, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ── Sortable queue item ────────────────────────────────────────────
function SortableQueueItem({
  song,
  actualIndex,
  displayIndex,
  queueLength,
  onSongClick,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  song: Song
  actualIndex: number
  displayIndex: number
  queueLength: number
  onSongClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `queue-${actualIndex}` })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--aurora-surface-hover)" : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer select-none active:bg-white/[0.03]"
      onClick={onSongClick}
    >
      {/* Drag handle */}
      <span
        className="flex-shrink-0 text-[var(--aurora-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>

      <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums w-5 text-right flex-shrink-0">
        {displayIndex}
      </span>

      <AlbumArt song={song} size="sm" className="flex-shrink-0 rounded-sm" />

      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--aurora-text)] truncate leading-tight">
          {song.title}
        </p>
        <p className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
          {song.artist}
        </p>
      </div>

      <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums flex-shrink-0 w-10 text-right">
        {formatDuration(song.duration)}
      </span>

      {/* Reorder buttons */}
      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp() }}
          disabled={actualIndex === 0}
          className="h-4 w-5 flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] disabled:opacity-40"
          aria-label="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown() }}
          disabled={actualIndex === queueLength - 1}
          className="h-4 w-5 flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] disabled:opacity-40"
          aria-label="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/10 transition-colors opacity-0 group-hover:opacity-100"
        aria-label={`Remove ${song.title} from queue`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────
interface QueuePanelProps {
  open: boolean
  onClose: () => void
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const currentSong = usePlayerStore((state) => state.currentSong)
  const queue = usePlayerStore((state) => state.queue)
  const queueIndex = usePlayerStore((state) => state.queueIndex)
  const queueHistory = usePlayerStore((state) => state.queueHistory)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue)
  const reorderQueue = usePlayerStore((state) => state.reorderQueue)
  const clearQueue = usePlayerStore((state) => state.clearQueue)
  const playSong = usePlayerStore((state) => state.playSong)

  const [historyOpen, setHistoryOpen] = useState(false)

  // Up Next = songs after current
  const upNext = queue.slice(queueIndex + 1)
  // History = last 20 entries (most recent last)
  const recentHistory = queueHistory.slice(-20).reverse()

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Sortable IDs for up-next items
  const sortableIds = upNext.map((_, i) => `queue-${queueIndex + 1 + i}`)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const fromActual = Number(String(active.id).replace("queue-", ""))
      const toActual = Number(String(over.id).replace("queue-", ""))
      if (isNaN(fromActual) || isNaN(toActual) || fromActual === toActual) return

      reorderQueue(fromActual, toActual)
    },
    [reorderQueue]
  )

  const handleSongClick = (song: Song) => {
    playSong(song, queue)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-[380px] max-w-[90vw] flex flex-col"
            style={{
              background: "var(--aurora-surface)",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
              borderLeft: "1px solid var(--aurora-rim)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--aurora-rim)" }}
            >
              <div className="flex items-center gap-2">
                <ListMusic className="h-4 w-4 text-[var(--aurora-text-secondary)]" strokeWidth={1.5} />
                <h2 className="font-display text-[16px] text-[var(--aurora-text)]">Queue</h2>
                {queue.length > 0 && (
                  <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums">
                    {queue.length} {queue.length === 1 ? "song" : "songs"}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.04] transition-colors"
                aria-label="Close queue panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {queue.length === 0 && queueHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <ListMusic className="h-8 w-8 text-[var(--aurora-text-tertiary)] opacity-40" />
                  <p className="font-display-italic text-[15px] text-[var(--aurora-text-tertiary)]">
                    Queue is empty
                  </p>
                  <p className="text-[11px] text-[var(--aurora-text-tertiary)]">
                    Play a song to start building a queue
                  </p>
                </div>
              ) : (
                <>
                  {/* Now Playing */}
                  {currentSong && (
                    <div className="px-5 pt-5 pb-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--aurora-text-tertiary)] mb-3 font-medium">
                        Now Playing
                      </p>
                      <div
                        className="flex items-center gap-3 p-2 rounded-lg"
                        style={{
                          background: "linear-gradient(to right, rgba(94,234,212,0.08) 0%, transparent 60%)",
                          border: "1px solid rgba(94,234,212,0.12)",
                        }}
                      >
                        <AlbumArt song={currentSong} size="sm" className="aurora-rim flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--aurora-text)] truncate">
                            {currentSong.title}
                          </p>
                          <p className="text-[11px] text-[var(--aurora-text-secondary)] truncate">
                            {currentSong.artist}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Equalizer playing={isPlaying} />
                        </div>
                        <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums flex-shrink-0 w-10 text-right">
                          {formatDuration(currentSong.duration)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Up Next */}
                  {upNext.length > 0 && (
                    <div className="px-5 pt-4 pb-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--aurora-text-tertiary)] mb-3 font-medium">
                        Up Next · {upNext.length}
                      </p>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                          <div className="flex flex-col gap-0.5">
                            {upNext.map((song, i) => {
                              const actualIndex = queueIndex + 1 + i
                              return (
                                <SortableQueueItem
                                  key={`${song.id}-${actualIndex}`}
                                  song={song}
                                  actualIndex={actualIndex}
                                  displayIndex={i + 1}
                                  queueLength={queue.length}
                                  onSongClick={() => handleSongClick(song)}
                                  onMoveUp={() => {
                                    if (actualIndex > 0) reorderQueue(actualIndex, actualIndex - 1)
                                  }}
                                  onMoveDown={() => {
                                    if (actualIndex < queue.length - 1) reorderQueue(actualIndex, actualIndex + 1)
                                  }}
                                  onRemove={() => removeFromQueue(actualIndex)}
                                />
                              )
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* History */}
                  {recentHistory.length > 0 && (
                    <div className="px-5 pt-4 pb-5">
                      <button
                        onClick={() => setHistoryOpen(!historyOpen)}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] transition-colors font-medium mb-3"
                      >
                        <span>History · {recentHistory.length}</span>
                        <motion.span
                          animate={{ rotate: historyOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </motion.span>
                      </button>
                      <AnimatePresence>
                        {historyOpen && (
                          <motion.div
                            className="flex flex-col gap-0.5"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {recentHistory.map((song, i) => (
                              <div
                                key={`history-${song.id}-${i}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--aurora-surface-hover)] transition-colors cursor-pointer opacity-60 hover:opacity-100 active:bg-white/[0.03]"
                                onClick={() => playSong(song, queue)}
                              >
                                <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums w-5 text-right flex-shrink-0">
                                  {recentHistory.length - i}
                                </span>

                                <AlbumArt song={song} size="sm" className="flex-shrink-0 rounded-sm" />

                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] text-[var(--aurora-text)] truncate leading-tight">
                                    {song.title}
                                  </p>
                                  <p className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
                                    {song.artist}
                                  </p>
                                </div>

                                <span className="text-[10px] text-[var(--aurora-text-tertiary)] tabular-nums flex-shrink-0 w-10 text-right">
                                  {formatDuration(song.duration)}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Past songs (remaining history, not shown in collapsed view but hinted) */}
                  {queueHistory.length > 20 && (
                    <div className="px-5 pb-5">
                      <p className="text-[10px] text-[var(--aurora-text-tertiary)] italic">
                        +{queueHistory.length - 20} older songs in history
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {queue.length > 1 && (
              <div
                className="px-5 py-3 flex-shrink-0"
                style={{ borderTop: "1px solid var(--aurora-rim)" }}
              >
                <button
                  onClick={clearQueue}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-danger)] hover:bg-[var(--aurora-danger)]/8 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Queue
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
