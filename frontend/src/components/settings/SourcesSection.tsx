import { useEffect, useState, useCallback } from "react"
import { useAddonStore } from "@/stores/addonStore"
import type { Addon } from "@/types"
import { Plus, Trash2, Cloud, AlertCircle } from "lucide-react"
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

export function SourcesSection() {
  const addons = useAddonStore((s) => s.addons)
  const addonsLoading = useAddonStore((s) => s.addonsLoading)
  const fetchAddons = useAddonStore((s) => s.fetchAddons)
  const addAddon = useAddonStore((s) => s.addAddon)
  const toggleAddon = useAddonStore((s) => s.toggleAddon)
  const removeAddon = useAddonStore((s) => s.removeAddon)

  const [urlInput, setUrlInput] = useState("")
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Addon | null>(null)

  useEffect(() => {
    fetchAddons()
  }, [fetchAddons])

  const handleAdd = useCallback(async () => {
    const url = urlInput.trim()
    if (!url) return
    setAdding(true)
    try {
      await addAddon(url)
      setUrlInput("")
    } catch {
      // toast already shown in store
    } finally {
      setAdding(false)
    }
  }, [urlInput, addAddon])

  const handleRemove = useCallback(async () => {
    if (!deleteTarget) return
    await removeAddon(deleteTarget.id)
    setDeleteTarget(null)
  }, [deleteTarget, removeAddon])

  return (
    <div
      className="rounded-xl overflow-hidden mt-6"
      style={{
        background: "var(--aurora-surface)",
        border: "1px solid var(--aurora-rim)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="px-5 py-3 border-b border-[var(--aurora-rim)]">
        <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)]">
          Sources
        </p>
      </div>

      {/* Add source input */}
      <div className="px-5 py-4 border-b border-[var(--aurora-rim)]">
        <p className="text-[14px] text-[var(--aurora-text)] font-medium mb-3">
          Add a source
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://addon.example.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
            disabled={adding}
            className="flex-1 bg-white/[0.06] border border-[var(--aurora-rim)] rounded-lg px-3 py-2 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] outline-none focus:border-[var(--aurora-accent-interactive)]/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !urlInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
            style={{
              background: "var(--aurora-accent-interactive)",
              color: "var(--aurora-slate)",
            }}
          >
            {adding ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Installed list */}
      <div className="px-5 py-4">
        <p className="text-[14px] text-[var(--aurora-text)] font-medium mb-3">
          Installed
        </p>

        {addonsLoading ? (
          <p className="text-[12px] text-[var(--aurora-text-tertiary)] py-2">
            Loading…
          </p>
        ) : addons.length === 0 ? (
          <div className="py-3 text-center">
            <Cloud className="h-5 w-5 text-[var(--aurora-text-tertiary)] mx-auto mb-2" />
            <p className="text-[12px] text-[var(--aurora-text-secondary)]">
              No sources installed yet
            </p>
            <p className="text-[11px] text-[var(--aurora-text-tertiary)] mt-1">
              Add a streaming source above to search online music catalogs
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {addons.map((addon) => (
              <AddonRow
                key={addon.id}
                addon={addon}
                onToggle={(enabled) => toggleAddon(addon.id, enabled)}
                onRemove={() => setDeleteTarget(addon)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.name ?? deleteTarget?.id}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unregister the addon. Songs already saved from it will stay in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Single addon row ────────────────────────────────────────────────────

function AddonRow({
  addon,
  onToggle,
  onRemove,
}: {
  addon: Addon
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  const isHealthy = addon.fail_count === 0

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{
        background: "var(--aurora-surface-inset)",
        boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
      }}
    >
      {/* Health dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isHealthy ? "bg-teal-400" : "bg-[var(--aurora-danger)]"
        }`}
        style={
          isHealthy
            ? { boxShadow: "0 0 6px rgba(45,212,191,0.5)" }
            : { boxShadow: "0 0 6px rgba(239,68,68,0.4)" }
        }
      />

      {/* Name + version */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--aurora-text)] truncate font-medium">
          {addon.name ?? addon.id}
        </p>
        <p className="text-[10px] text-[var(--aurora-text-tertiary)] mt-0.5">
          {addon.version ? `v${addon.version}` : "unknown version"}
          {!isHealthy && (
            <span className="text-[var(--aurora-danger)] ml-2">
              <AlertCircle className="inline h-3 w-3 -mt-0.5 mr-0.5" />
              {addon.fail_count} failure{addon.fail_count > 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      {/* Enable toggle */}
      <button
        onClick={() => onToggle(!addon.enabled)}
        role="switch"
        aria-checked={addon.enabled}
        aria-label={`${addon.enabled ? "Disable" : "Enable"} ${addon.name ?? addon.id}`}
        className={`relative rounded-full transition-colors duration-200 flex-shrink-0 ${
          addon.enabled
            ? "bg-[var(--aurora-accent-interactive)]"
            : "bg-white/[0.12]"
        }`}
        style={{ height: "22px", width: "40px" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: addon.enabled ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-md transition-colors text-[var(--aurora-text-tertiary)] hover:bg-[var(--aurora-danger)]/15 hover:text-[var(--aurora-danger)]"
        aria-label={`Remove ${addon.name ?? addon.id}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
