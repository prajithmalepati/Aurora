import { useState, useRef, useCallback, useEffect } from "react"
import { GripVertical, RotateCcw, Columns3 } from "lucide-react"
import { useColumnStore, type ColumnContext } from "@/stores/columnStore"
import { TOGGLEABLE_COLUMN_IDS, DEFAULT_ORDER, getColumn, type ColumnId } from "./columns"

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

  // Drag state
  const dragIdRef = useRef<ColumnId | null>(null)
  const [dragOverId, setDragOverId] = useState<ColumnId | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, id: ColumnId) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: ColumnId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragIdRef.current && dragIdRef.current !== id) {
      setDragOverId(id)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: ColumnId) => {
    e.preventDefault()
    const sourceId = dragIdRef.current
    if (!sourceId || sourceId === targetId) return

    // Operate on the full current order array directly
    const currentOrder = config.order.length > 0 ? [...config.order] : [...DEFAULT_ORDER]
    const sourceIndex = currentOrder.indexOf(sourceId)
    const targetIndex = currentOrder.indexOf(targetId)
    if (sourceIndex === -1 || targetIndex === -1) return

    // Splice: remove source, insert at target's position
    currentOrder.splice(sourceIndex, 1)
    currentOrder.splice(targetIndex, 0, sourceId)

    setOrder(columnContext, currentOrder)
    dragIdRef.current = null
    setDragOverId(null)
  }, [config.order, columnContext, setOrder])

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null
    setDragOverId(null)
  }, [])

  // Get the toggleable columns in their current order
  const fullOrder = config.order.length > 0 ? config.order : ["index", "title", ...TOGGLEABLE_COLUMN_IDS, "actions"] as ColumnId[]
  const toggleableOrder = fullOrder.filter((id) => TOGGLEABLE_COLUMN_IDS.includes(id))
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
          className="absolute right-0 top-full mt-1 z-50 min-w-[200px] max-w-[260px] py-1.5 rounded-lg shadow-xl border backdrop-blur-xl"
          style={{
            background: "color-mix(in oklch, var(--aurora-surface) 92%, transparent)",
            borderColor: "var(--aurora-rim)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div className="px-3.5 py-1.5 border-b border-[var(--aurora-rim)] mb-1">
            <span className="text-[11px] font-medium text-[var(--aurora-text-secondary)]">
              Columns
            </span>
          </div>

          {/* Column list — drag-reorderable */}
          <div className="py-0.5">
            {toggleableOrder.map((id) => {
              const col = getColumn(id)
              const isHidden = hiddenSet.has(id)
              const isDragging = dragIdRef.current === id
              const isDragOver = dragOverId === id

              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, id)}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => handleDrop(e, id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-[12px] cursor-grab active:cursor-grabbing transition-colors duration-150 ${
                    isDragging ? "opacity-40" : ""
                  } ${isDragOver ? "border-t-2 border-[var(--aurora-accent-interactive)]" : ""}`}
                >
                  <GripVertical className="h-3 w-3 text-[var(--aurora-text-tertiary)] flex-shrink-0" />
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!isHidden}
                    onClick={() => toggleVisible(columnContext, id)}
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
                  <span className={`${isHidden ? "text-[var(--aurora-text-tertiary)]" : "text-[var(--aurora-text)]"}`}>
                    {col.label}
                  </span>
                </div>
              )
            })}
          </div>

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
