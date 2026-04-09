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
      const res = await api.post<ApiResponse<ScanResult>>(
        "/scan",
        {
          folder_path: state.folderPath.trim(),
          playlist_name: state.playlistName.trim() || undefined,
        }
      )
      setState((s) => ({ ...s, results: res.data, loading: false }))
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
      <DialogContent className="bg-[var(--aurora-bg-surface)] border-[var(--aurora-border)] text-[var(--aurora-text)] shadow-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Music Folder</DialogTitle>
          <DialogDescription className="text-[var(--aurora-text-dim)]">
            Select a folder to scan for music files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-[var(--aurora-text-dim)]">
              Folder Path <span className="text-[var(--aurora-danger)]">*</span>
            </label>
            <Input
              type="text"
              placeholder="C:\Users\rockz\Music\Rock"
              value={state.folderPath}
              onChange={(e) =>
                setState((s) => ({ ...s, folderPath: e.target.value, error: null }))
              }
              className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              disabled={state.loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[var(--aurora-text-dim)]">
              Playlist Name (optional)
            </label>
            <Input
              type="text"
              placeholder="Auto-create playlist (optional)"
              value={state.playlistName}
              onChange={(e) =>
                setState((s) => ({ ...s, playlistName: e.target.value, error: null }))
              }
              className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
              disabled={state.loading}
            />
          </div>

          {state.error && (
            <div className="text-sm text-[var(--aurora-danger)]">{state.error}</div>
          )}

          {state.results && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--aurora-text)]">
                <div>
                  <span className="text-[var(--aurora-teal)]">Imported:</span>{" "}
                  {state.results.imported} songs
                </div>
                <div>
                  <span className="text-[var(--aurora-text-dim)]">Skipped:</span>{" "}
                  {state.results.skipped} duplicates
                </div>
              </div>

              {state.results.errors.length > 0 && (
                <div className="border-t border-[var(--aurora-border)] pt-3">
                  <div className="text-sm text-[var(--aurora-danger)] mb-2">
                    Errors: {state.results.errors.length}
                  </div>
                  <ul className="space-y-1">
                    {state.results.errors.map((err, idx) => (
                      <li key={idx} className="text-xs text-[var(--aurora-text-dim)]">
                        <span className="text-[var(--aurora-text)]">{err.file}:</span>{" "}
                        {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button
                  onClick={handleDone}
                  className="bg-[var(--aurora-teal)] text-[var(--aurora-bg-deep)]"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>

        {!state.results && (
          <DialogFooter>
            <Button
              onClick={handleScan}
              disabled={!state.folderPath.trim() || state.loading}
              className="bg-[var(--aurora-teal)] text-[var(--aurora-bg-deep)]"
            >
              {state.loading ? "Scanning..." : "Scan"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}