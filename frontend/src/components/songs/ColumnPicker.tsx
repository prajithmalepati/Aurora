import { useState, useRef, useCallback, useEffect } from "react"
import { GripVertical, RotateCcw, Columns3 } from "lucide-react"
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useColumnStore, type ColumnContext } from "@/stores/columnStore"
import { TOGGLEABLE_COLUMN_IDS, DEFAULT_ORDER, FIXED_COLUMN_IDS, getColumn, type ColumnId } from "./columns"

// ── Sortable item ──────────────────────────────────────────────────
function SortableColumnItem({
  id,
  isHidden,
  onToggle,
}: {
  id: ColumnId
  isHidden: boolean
  onToggle: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const col = getColumn(id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3.5 py-1.5 text-[12px] cursor-grab select-none active:cursor-grabbing transition-colors duration-150"
    >
      <button
        type="button"
        className="flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-[var(--aurora-text-tertiary)]" />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={!isHidden}
        onClick={onToggle}
        className="h-3.5 w-3.5 rounded-[2px] flex items-center justify-center transition-[color,background-color,border-color] duration-150 flex-shrink-0"
        style={{
          background: isHidden ? "transparent" : "var(--aurora-accent-interactive)",
          border: isHidden
            ? "1.5px solid var(--aurora-text-tertiary)"
            : "1.5px solid var(--aurora-accent-interactive)",
        }}
      >
        {!isHidden && (
          <svg width="8" height="6" viewBox="0 0 10 8" fill="none" className="text-black">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span className={isHidden ? "text-[var(--aurora-text-tertiary)]" : "text-[var(--aurora-text)]"}>
        {col.label}
      </span>
    </div>
  )
}

// ── Main picker ────────────────────────────────────────────────────
interface ColumnPickerProps {
  columnContext: ColumnContext
}

export function ColumnPicker({ columnContext }: ColumnPickerProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const config = useColumnStore((s) => s.getConfig(columnContext))
  const toggleVisible = useColumnStore((s) => s.toggleVisible)
  const setOrder = useColumnStore((s) => s.setOrder)
  const reset = useColumnStore((s) => s.reset)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Build ordered toggleable list: start from canonical set, order by config.order
  const orderedIds = (() => {
    const inOrder = config.order.filter((id) => TOGGLEABLE_COLUMN_IDS.includes(id as ColumnId)) as ColumnId[]
    const missing = TOGGLEABLE_COLUMN_IDS.filter((id) => !inOrder.includes(id))
    return [...inOrder, ...missing]
  })()

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = orderedIds.indexOf(active.id as ColumnId)
      const newIndex = orderedIds.indexOf(over.id as ColumnId)
      if (oldIndex === -1 || newIndex === -1) return

      const newToggleable = arrayMove(orderedIds, oldIndex, newIndex)

      // Rebuild full order: walk DEFAULT_ORDER, pin fixed columns to their
      // canonical slots, fill toggleable slots with newToggleable in order.
      let t = 0
      const fullOrder = DEFAULT_ORDER.map((id) =>
        FIXED_COLUMN_IDS.includes(id) ? id : newToggleable[t++]
      ) as ColumnId[]
      setOrder(columnContext, fullOrder)
    },
    [orderedIds, config.order, columnContext, setOrder]
  )

  const hiddenSet = new Set(config.hidden)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
          open
            ? "text-[var(--aurora-accent-interactive)] bg-[var(--aurora-accent-interactive)]/10"
            : "text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] hover:bg-white/[0.04]"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columns
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[200px] max-w-[260px] py-1.5 rounded-lg shadow-xl border"
          style={{
            background: "var(--aurora-surface-2)",
            borderColor: "var(--aurora-rim)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div className="px-3.5 py-1.5 border-b border-[var(--aurora-rim)] mb-1">
            <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
              Columns
            </span>
          </div>

          {/* Column list — dnd-kit sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className="py-0.5">
                {orderedIds.map((id) => (
                  <SortableColumnItem
                    key={id}
                    id={id}
                    isHidden={hiddenSet.has(id)}
                    onToggle={() => toggleVisible(columnContext, id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Reset */}
          <div className="border-t border-[var(--aurora-rim)] mt-1 pt-1">
            <button
              onClick={() => { reset(columnContext); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3.5 py-1.5 text-[11px] text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text-secondary)] hover:bg-white/[0.04] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
