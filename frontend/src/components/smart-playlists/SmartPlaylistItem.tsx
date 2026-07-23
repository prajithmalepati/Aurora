import { useState } from "react"
import { Sparkles, MoreHorizontal, Pencil, Edit3, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import type { SmartPlaylistDefinition } from "@/types"
import { useSmartPlaylistStore } from "@/stores/smartPlaylistStore"
import { toast } from "@/lib/toast"

interface SmartPlaylistItemProps {
  sp: SmartPlaylistDefinition
  isActive: boolean
  onSelect: () => void
  onEditInMix: (sp: SmartPlaylistDefinition) => void
  onRename: (sp: SmartPlaylistDefinition) => void
}

export function SmartPlaylistItem({ sp, isActive, onSelect, onEditInMix, onRename }: SmartPlaylistItemProps) {
  const deleteSmartPlaylist = useSmartPlaylistStore((s) => s.deleteSmartPlaylist)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteSmartPlaylist(sp.id)
      toast.success(`"${sp.name}" deleted`)
    } catch {
      toast.error("Failed to delete smart playlist")
    }
  }

  return (
    <>
      <button
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenuOpen(true)
        }}
        className={`group relative w-full flex items-center gap-2 px-3 py-[6px] rounded-md text-left transition-colors duration-150 active:bg-white/[0.03] ${
          isActive
            ? "text-[var(--aurora-text)] bg-white/[0.05]"
            : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
        }`}
      >
        {isActive && (
          <span
            className="absolute inset-0 rounded-md pointer-events-none"
            style={{ background: "var(--aurora-surface)" }}
            aria-hidden="true"
          />
        )}
        <span
          className={`absolute inset-0 rounded-md transition-opacity duration-150 pointer-events-none ${
            isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ background: "var(--aurora-surface-hover)" }}
          aria-hidden="true"
        />
        <span className="relative z-10 flex-shrink-0">
          <Sparkles
            className="h-3.5 w-3.5"
            strokeWidth={1.5}
            style={{
              color: isActive ? "var(--aurora-accent-interactive)" : undefined,
            }}
          />
        </span>
        <span className="relative z-10 flex-1 min-w-0 truncate text-[13px] font-medium tracking-tight">
          {sp.emoji ? `${sp.emoji} ` : ""}{sp.name}
        </span>
        {/* Overflow menu — visible on hover */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 h-5 w-5 rounded flex items-center justify-center text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.06]"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(true) }}
            aria-label="Smart playlist actions"
          >
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
            <DropdownMenuItem
              onClick={() => onEditInMix(sp)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit in Mix
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRename(sp)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </button>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete smart playlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{sp.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
