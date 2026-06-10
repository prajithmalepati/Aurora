import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ScanResult } from "@/types"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "@/lib/toast"
import { api, getBaseUrl } from "@/lib/api"

interface ScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ScanProgress {
  done: number
  total: number
  current: string
}

interface ScanState {
  folderPath: string
  playlistName: string
  results: ScanResult | null
  loading: boolean
  error: string | null
  progress: ScanProgress | null
  watchFolder: boolean
}

const INITIAL_STATE: ScanState = {
  folderPath: "",
  playlistName: "",
  results: null,
  loading: false,
  error: null,
  progress: null,
  watchFolder: false,
}

export function ScanDialog({ open, onOpenChange }: ScanDialogProps) {
  const [state, setState] = useState<ScanState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const fetchSongs = useSongStore((s) => s.fetchSongs)
  const fetchPlaylists = usePlaylistStore((s) => s.fetchPlaylists)

  const handleScan = async () => {
    if (!state.folderPath.trim()) {
      setState((s) => ({ ...s, error: "Folder path is required" }))
      return
    }

    setState((s) => ({ ...s, loading: true, error: null, progress: null }))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${getBaseUrl()}/api/scan/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_path: state.folderPath.trim(),
          playlist_name: state.playlistName.trim() || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }))
        throw new Error(err.detail || res.statusText)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          let data: Record<string, unknown>
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === "total") {
            setState((s) => ({ ...s, progress: { done: 0, total: data.total as number, current: "" } }))
          } else if (data.type === "progress") {
            setState((s) => ({
              ...s,
              progress: {
                done: data.done as number,
                total: data.total as number,
                current: data.current as string,
              },
            }))
          } else if (data.type === "done") {
            const result = data as unknown as ScanResult & { type: string }
            setState((s) => ({ ...s, loading: false, results: result, progress: null }))
            const parts: string[] = []
            if (result.imported) parts.push(`${result.imported} new`)
            if (result.replaced) parts.push(`${result.replaced} upgraded`)
            toast.success(parts.length ? `Imported: ${parts.join(", ")}` : "Scan complete — nothing new")
          } else if (data.type === "error") {
            throw new Error(data.message as string)
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setState((s) => ({ ...s, loading: false, error: "Scan cancelled.", progress: null }))
      } else {
        const message = err instanceof Error ? err.message : "Failed to scan folder"
        setState((s) => ({ ...s, loading: false, error: message, progress: null }))
        toast.error(message)
      }
    } finally {
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleDone = async () => {
    // If "watch this folder" is checked, register the folder
    if (state.watchFolder && state.folderPath.trim()) {
      try {
        await api.post("/watch", { path: state.folderPath.trim() })
        toast.success("Folder added to watch list")
      } catch {
        toast.error("Failed to add folder to watch list")
      }
    }
    fetchSongs()
    fetchPlaylists()
    onOpenChange(false)
    setState(INITIAL_STATE)
  }

  const handleClose = (open: boolean) => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
    }
    onOpenChange(open)
    if (!open) {
      setState(INITIAL_STATE)
    }
  }

  const progressPct = state.progress && state.progress.total > 0
    ? Math.round((state.progress.done / state.progress.total) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan a music folder</DialogTitle>
          <DialogDescription>
            Select a folder to scan for music files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="label-micro text-[9.5px]">
              Folder path <span className="text-[var(--aurora-danger)]">*</span>
            </label>
            <Input
              type="text"
              placeholder="C:\Users\rockz\Music\Rock"
              value={state.folderPath}
              onChange={(e) => setState((s) => ({ ...s, folderPath: e.target.value, error: null }))}
              disabled={state.loading}
            />
          </div>

          <div className="space-y-2">
            <label className="label-micro text-[9.5px]">Playlist name (optional)</label>
            <Input
              type="text"
              placeholder="Auto-create a playlist from this folder"
              value={state.playlistName}
              onChange={(e) => setState((s) => ({ ...s, playlistName: e.target.value, error: null }))}
              disabled={state.loading}
            />
          </div>

          {/* Watch folder checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.watchFolder}
              onChange={(e) => setState((s) => ({ ...s, watchFolder: e.target.checked }))}
              disabled={state.loading}
              className="w-3.5 h-3.5 rounded border-[var(--aurora-rim)] accent-[var(--aurora-accent-interactive)]"
            />
            <span className="text-[12px] text-[var(--aurora-text-secondary)]">
              Auto-watch this folder for new music
            </span>
          </label>

          {/* Progress bar */}
          {state.progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--aurora-text-secondary)] truncate max-w-[80%]">
                  {state.progress.current || "Scanning…"}
                </span>
                <span className="text-[var(--aurora-text-tertiary)] tabular-nums flex-shrink-0">
                  {state.progress.done}/{state.progress.total}
                </span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--aurora-surface)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${progressPct}%`,
                    background: "linear-gradient(to right, var(--aurora-accent-interactive), var(--aurora-secondary))",
                  }}
                />
              </div>
            </div>
          )}

          {state.error && (
            <div className="text-[12px] text-[var(--aurora-danger)]">{state.error}</div>
          )}

          {state.results && (
            <div
              className="rounded-lg p-4 space-y-3"
              style={{
                background: "var(--aurora-surface-inset)",
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "var(--aurora-accent-interactive-hover)", boxShadow: "0 0 6px var(--aurora-accent-interactive-hover)" }}
                  />
                  <span className="text-[var(--aurora-text)] tabular-nums">
                    {state.results.imported} imported
                  </span>
                </div>
                {state.results.replaced > 0 && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "var(--aurora-secondary)", boxShadow: "0 0 6px var(--aurora-secondary-glow)" }}
                    />
                    <span className="text-[var(--aurora-text)] tabular-nums">
                      {state.results.replaced} upgraded (lower-quality replaced)
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--aurora-text-tertiary)]" />
                  <span className="text-[var(--aurora-text-secondary)] tabular-nums">
                    {state.results.skipped} skipped
                    {state.results.skipped_lower_quality > 0 && (
                      <span className="text-[var(--aurora-text-tertiary)]">
                        {" "}({state.results.skipped_lower_quality} lower-quality than library)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {state.results.errors.length > 0 && (
                <div className="pt-3" style={{ borderTop: "1px solid var(--aurora-rim)" }}>
                  <div className="text-[12px] text-[var(--aurora-danger)] mb-2 font-medium">
                    {state.results.errors.length} error{state.results.errors.length === 1 ? "" : "s"}
                  </div>
                  <ul className="space-y-1 max-h-[120px] overflow-y-auto">
                    {state.results.errors.map((err, idx) => (
                      <li key={idx} className="text-[11px] text-[var(--aurora-text-secondary)] font-mono">
                        <span className="text-[var(--aurora-text)]">{err.file}:</span>{" "}
                        {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-5">
          {state.results ? (
            <Button onClick={handleDone} variant="primary">
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={state.loading ? handleCancel : () => handleClose(false)}
                disabled={false}
              >
                {state.loading ? "Cancel" : "Close"}
              </Button>
              <Button
                onClick={handleScan}
                disabled={!state.folderPath.trim() || state.loading}
                variant="primary"
              >
                {state.loading ? "Scanning…" : "Scan"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
