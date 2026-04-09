import { useState } from "react"
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
import { api } from "@/lib/api"
import type { ApiResponse, ScanResult } from "@/types"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "sonner"

interface ScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ScanState {
  folderPath: string
  playlistName: string
  results: ScanResult | null
  loading: boolean
  error: string | null
}

export function ScanDialog({ open, onOpenChange }: ScanDialogProps) {
  const [state, setState] = useState<ScanState>({
    folderPath: "",
    playlistName: "",
    results: null,
    loading: false,
    error: null,
  })

  const fetchSongs = useSongStore((state) => state.fetchSongs)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)

  const handleScan = async () => {
    if (!state.folderPath.trim()) {
      setState((s) => ({ ...s, error: "Folder path is required" }))
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const res = await api.post<ApiResponse<ScanResult>>("/scan", {
        folder_path: state.folderPath.trim(),
        playlist_name: state.playlistName.trim() || undefined,
      })
      setState((s) => ({ ...s, results: res.data, loading: false }))
      toast.success(
        `Scan complete — ${res.data.imported} song${res.data.imported === 1 ? "" : "s"} imported`
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to scan folder"
      setState((s) => ({ ...s, loading: false, error: message }))
      toast.error(message)
    }
  }

  const handleDone = () => {
    fetchSongs()
    fetchPlaylists()
    onOpenChange(false)
    setState({
      folderPath: "",
      playlistName: "",
      results: null,
      loading: false,
      error: null,
    })
  }

  const handleClose = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setState({
        folderPath: "",
        playlistName: "",
        results: null,
        loading: false,
        error: null,
      })
    }
  }

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
              onChange={(e) =>
                setState((s) => ({ ...s, folderPath: e.target.value, error: null }))
              }
              disabled={state.loading}
            />
          </div>

          <div className="space-y-2">
            <label className="label-micro text-[9.5px]">Playlist name (optional)</label>
            <Input
              type="text"
              placeholder="Auto-create a playlist from this folder"
              value={state.playlistName}
              onChange={(e) =>
                setState((s) => ({ ...s, playlistName: e.target.value, error: null }))
              }
              disabled={state.loading}
            />
          </div>

          {state.error && (
            <div className="text-[12px] text-[var(--aurora-danger)]">{state.error}</div>
          )}

          {state.results && (
            <div
              className="rounded-lg p-4 space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
              }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "#5eead4",
                      boxShadow: "0 0 6px #5eead4",
                    }}
                  />
                  <span className="text-[var(--aurora-text)] tabular-nums">
                    {state.results.imported} imported
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora-text-muted)]" />
                  <span className="text-[var(--aurora-text-dim)] tabular-nums">
                    {state.results.skipped} skipped (duplicates)
                  </span>
                </div>
              </div>

              {state.results.errors.length > 0 && (
                <div className="pt-3" style={{ borderTop: "1px solid var(--aurora-rim)" }}>
                  <div className="text-[12px] text-[var(--aurora-danger)] mb-2 font-medium">
                    {state.results.errors.length} error
                    {state.results.errors.length === 1 ? "" : "s"}
                  </div>
                  <ul className="space-y-1 max-h-[120px] overflow-y-auto">
                    {state.results.errors.map((err, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] text-[var(--aurora-text-dim)] font-mono"
                      >
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
                onClick={() => handleClose(false)}
                disabled={state.loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleScan}
                disabled={!state.folderPath.trim() || state.loading}
                variant="primary"
              >
                {state.loading ? "Scanning..." : "Scan"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
