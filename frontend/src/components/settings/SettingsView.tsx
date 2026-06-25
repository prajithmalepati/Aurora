import { useState, useEffect, useCallback, useRef } from "react"
import { useSettingsStore } from "@/stores/settingsStore"
import type { CrossfadeCurve } from "@/stores/settingsStore"
import { resetWelcome } from "@/components/welcome/WelcomeOverlay"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { WatchedFolder } from "@/types"
import type { ApiResponse } from "@/types"
import { checkForUpdates } from "@/lib/updater"
import { ScanDialog } from "@/components/scanner/ScanDialog"
import { AddSongDialog } from "@/components/songs/AddSongDialog"
import { UpdateCard } from "@/components/settings/UpdateCard"
import { ZoomControl } from "@/components/settings/ZoomControl"
import { usePlaylistStore } from "@/stores/playlistStore"
import { FolderSearch, Music, Upload } from "lucide-react"

export function SettingsView() {
  const crossfadeEnabled = useSettingsStore((s) => s.crossfadeEnabled)
  const crossfadeDuration = useSettingsStore((s) => s.crossfadeDuration)
  const crossfadeCurve = useSettingsStore((s) => s.crossfadeCurve)
  const replaygainMode = useSettingsStore((s) => s.replaygainMode)
  const setCrossfadeEnabled = useSettingsStore((s) => s.setCrossfadeEnabled)
  const setCrossfadeDuration = useSettingsStore((s) => s.setCrossfadeDuration)
  const setCrossfadeCurve = useSettingsStore((s) => s.setCrossfadeCurve)
  const setReplaygainMode = useSettingsStore((s) => s.setReplaygainMode)
  const respectTrims = useSettingsStore((s) => s.respectTrims)
  const setRespectTrims = useSettingsStore((s) => s.setRespectTrims)

  const durPct = ((crossfadeDuration - 1) / 11) * 100

  // ── Library management state ──────────────────────────────────────
  const [scanOpen, setScanOpen] = useState(false)
  const [addSongOpen, setAddSongOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.postUpload<{data: {playlist_id: number, name: string, matched_count: number, unmatched_paths: string[]}, message: string}>('/playlists/import', formData)
      const { name, matched_count, unmatched_paths } = res.data
      toast.success(`Imported: ${matched_count} songs matched to "${name}"`)
      if (unmatched_paths && unmatched_paths.length > 0) {
        toast(`${unmatched_paths.length} file(s) not found in library`, { duration: 6000 })
      }
      await fetchPlaylists()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast.error(message)
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // ── Watched folders state ──────────────────────────────────────────
  const [watchedFolders, setWatchedFolders] = useState<WatchedFolder[]>([])
  const [scanningId, setScanningId] = useState<number | null>(null)

  const fetchWatchedFolders = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<WatchedFolder[]>>("/watch")
      setWatchedFolders(res.data)
    } catch {
      // Silently fail — watcher may not be available
    }
  }, [])

  useEffect(() => {
    fetchWatchedFolders()
  }, [fetchWatchedFolders])

  const handleRemoveFolder = async (id: number) => {
    try {
      await api.delete(`/watch/${id}`)
      setWatchedFolders((prev) => prev.filter((f) => f.id !== id))
      toast.success("Folder removed from watch list")
    } catch {
      toast.error("Failed to remove folder")
    }
  }

  const handleTriggerScan = async (id: number) => {
    setScanningId(id)
    try {
      await api.post(`/watch/${id}/scan`, {})
      toast.success("Scan triggered")
      fetchWatchedFolders()
    } catch {
      toast.error("Failed to trigger scan")
    } finally {
      setScanningId(null)
    }
  }

  const durationPresets: { label: string; value: number }[] = [
    { label: "Short", value: 3 },
    { label: "Medium", value: 5 },
    { label: "Long", value: 8 },
    { label: "Extended", value: 12 },
  ]

  return (
    <div className="aurora-view-enter p-4 sm:p-10 max-w-[600px]">
      <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)] mb-8">
        Settings
      </h1>

      {/* Library Management section */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--aurora-surface)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-5 py-3 border-b border-[var(--aurora-rim)]">
          <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)]">Library Management</p>
        </div>

        <button
          onClick={() => setScanOpen(true)}
          className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left border-b border-[var(--aurora-rim)]"
        >
          <FolderSearch className="h-4 w-4 text-[var(--aurora-text-secondary)]" />
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Scan Folder</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Add music from a folder to your library
            </p>
          </div>
        </button>

        <button
          onClick={() => setAddSongOpen(true)}
          className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left border-b border-[var(--aurora-rim)]"
        >
          <Music className="h-4 w-4 text-[var(--aurora-text-secondary)]" />
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Add Song</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Add a single song file to your library
            </p>
          </div>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importLoading}
          className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left disabled:opacity-50"
        >
          {importLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-[var(--aurora-text-secondary)]" />
          ) : (
            <Upload className="h-4 w-4 text-[var(--aurora-text-secondary)]" />
          )}
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Import Playlist</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Import songs from an M3U, M3U8, or JSON file into a new playlist
            </p>
          </div>
        </button>
      </div>

      {/* Audio section */}
      <div
        className="rounded-xl overflow-hidden mt-6"
        style={{
          background: "var(--aurora-surface)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-5 py-3 border-b border-[var(--aurora-rim)]">
          <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)]">Audio</p>
        </div>

        {/* Crossfade toggle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Crossfade</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Blend songs smoothly as they transition
            </p>
          </div>
          <button
            onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
            role="switch"
            aria-checked={crossfadeEnabled}
            className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0 ${
              crossfadeEnabled
                ? "bg-[var(--aurora-accent-interactive)]"
                : "bg-white/[0.12]"
            }`}
            style={{ height: "22px", width: "40px" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: crossfadeEnabled ? "translateX(18px)" : "translateX(0)" }}
            />
          </button>
        </div>

        {/* Duration presets + slider */}
        <div
          className="px-5 py-4 border-t border-[var(--aurora-rim)] transition-opacity duration-200"
          style={{ opacity: crossfadeEnabled ? 1 : 0.35, pointerEvents: crossfadeEnabled ? "auto" : "none" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] text-[var(--aurora-text)]">Duration</p>
            <span className="text-[13px] tabular-nums text-[var(--aurora-accent-interactive)] font-medium">
              {crossfadeDuration}s
            </span>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-1.5 mb-3">
            {durationPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setCrossfadeDuration(preset.value)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 active:bg-white/[0.03] ${
                  crossfadeDuration === preset.value
                    ? "bg-[var(--aurora-accent-interactive)]/15 text-[var(--aurora-accent-interactive)]"
                    : "bg-white/[0.06] text-[var(--aurora-text-secondary)] hover:bg-white/[0.10] hover:text-[var(--aurora-text)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--aurora-text-tertiary)] w-4">1s</span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
              className="aurora-range flex-1"
              style={{ ["--aurora-range-pct" as string]: `${durPct}%` }}
              aria-label="Crossfade duration"
            />
            <span className="text-[11px] text-[var(--aurora-text-tertiary)] w-5">12s</span>
          </div>
        </div>

        {/* Crossfade curve */}
        <div
          className="px-5 py-4 border-t border-[var(--aurora-rim)] transition-opacity duration-200"
          style={{ opacity: crossfadeEnabled ? 1 : 0.35, pointerEvents: crossfadeEnabled ? "auto" : "none" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[14px] text-[var(--aurora-text)] font-medium">Fade curve</p>
              <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
                How the two songs blend during transition
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {([
              {
                value: "linear" as CrossfadeCurve,
                label: "Linear",
                outgoing: "M 0 0 L 80 40",
                incoming: "M 0 40 L 80 0",
              },
              {
                value: "equalpower" as CrossfadeCurve,
                label: "Equal Power",
                outgoing: "M 0 0 C 20 0 60 40 80 40",
                incoming: "M 0 40 C 20 40 60 0 80 0",
              },
              {
                value: "overlap" as CrossfadeCurve,
                label: "Overlap",
                outgoing: "M 0 0 L 65 0 L 80 40",
                incoming: "M 0 0 L 80 0",
              },
              {
                value: "lagged" as CrossfadeCurve,
                label: "Lagged",
                outgoing: "M 0 0 L 80 40",
                incoming: "M 0 40 L 40 40 L 80 0",
              },
            ]).map(({ value, label, outgoing, incoming }) => (
              <button
                key={value}
                onClick={() => setCrossfadeCurve(value)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg text-[12px] font-medium transition-colors active:bg-white/[0.03] ${
                  crossfadeCurve === value
                    ? "bg-[var(--aurora-accent-interactive)]/15 text-[var(--aurora-accent-interactive)] ring-1 ring-[var(--aurora-accent-interactive)]/30"
                    : "bg-white/[0.06] text-[var(--aurora-text-secondary)] hover:bg-white/[0.10] hover:text-[var(--aurora-text)]"
                }`}
              >
                <svg viewBox="0 0 80 40" className="w-20 h-10" fill="none">
                  <line x1="0" y1="20" x2="80" y2="20" stroke="currentColor" strokeOpacity={0.15} strokeWidth="0.75" strokeDasharray="2 2" />
                  <path d={outgoing} stroke="#f97316" strokeOpacity={0.7} strokeWidth="1.5" />
                  <path d={incoming} stroke="#5eead4" strokeOpacity={0.7} strokeWidth="1.5" strokeDasharray="3 2" />
                </svg>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--aurora-text-tertiary)] mt-2">
            {crossfadeCurve === "linear" && "Both tracks fade evenly — a smooth X-shaped crossfade."}
            {crossfadeCurve === "equalpower" && "Keeps combined volume steady so the mix doesn't dip in the middle."}
            {crossfadeCurve === "overlap" && "Both play at full volume, then the old track cuts out at the end."}
            {crossfadeCurve === "lagged" && "Outgoing starts fading first; incoming joins halfway through."}
          </p>
        </div>

        {/* ReplayGain mode */}
        <div className="px-5 py-4 border-t border-[var(--aurora-rim)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[14px] text-[var(--aurora-text)] font-medium">ReplayGain</p>
              <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
                Normalize loudness across songs
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["off", "track", "album"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setReplaygainMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors active:bg-white/[0.03] ${
                  replaygainMode === mode
                    ? "bg-[var(--aurora-accent-interactive)] text-white"
                    : "bg-white/[0.08] text-[var(--aurora-text-secondary)] hover:bg-white/[0.12]"
                }`}
              >
                {mode === "off" ? "Off" : mode === "track" ? "Track" : "Album"}
              </button>
            ))}
          </div>
        </div>

        {/* Respect song trims */}
        <div className="px-5 py-4 border-t border-[var(--aurora-rim)] flex items-center justify-between">
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Respect song trims</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Play playlist songs between their trim points and crossfade at the trim-out
            </p>
          </div>
          <button
            onClick={() => setRespectTrims(!respectTrims)}
            role="switch"
            aria-label="Respect song trims"
            aria-checked={respectTrims}
            className={`relative rounded-full transition-colors duration-200 flex-shrink-0 ${
              respectTrims
                ? "bg-[var(--aurora-accent-interactive)]"
                : "bg-white/[0.12]"
            }`}
            style={{ height: "22px", width: "40px" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: respectTrims ? "translateX(18px)" : "translateX(0)" }}
            />
          </button>
        </div>

        {/* Manual skip info */}
        <div className="px-5 py-4 border-t border-[var(--aurora-rim)] flex items-center justify-between">
          <p className="text-[13px] text-[var(--aurora-text-secondary)]">Manual skip fade</p>
          <span className="text-[13px] tabular-nums text-[var(--aurora-text-tertiary)]">1s (fixed)</span>
        </div>
      </div>

      {/* Display section */}
      <div
        className="rounded-xl overflow-hidden mt-6"
        style={{
          background: "var(--aurora-surface)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-5 py-3 border-b border-[var(--aurora-rim)]">
          <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)]">Display</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Zoom</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Scale the entire interface.
            </p>
          </div>
          <ZoomControl />
        </div>
      </div>

      {/* Watched Folders section */}
      <div
        className="rounded-xl overflow-hidden mt-6"
        style={{
          background: "var(--aurora-surface)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-5 py-3 border-b border-[var(--aurora-rim)]">
          <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)]">Auto-Watch</p>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3">
            <p className="text-[14px] text-[var(--aurora-text)] font-medium">Watched Folders</p>
            <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
              Folders are polled every 30 seconds for new or changed music files
            </p>
          </div>

          {watchedFolders.length === 0 ? (
            <p className="text-[12px] text-[var(--aurora-text-tertiary)] py-2">
              No folders watched yet. Use the Scan dialog to add one.
            </p>
          ) : (
            <div className="space-y-2">
              {watchedFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: "var(--aurora-surface-inset)",
                    boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
                  }}
                >
                  {/* Status dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      folder.is_active ? "bg-green-400" : "bg-[var(--aurora-text-tertiary)]"
                    }`}
                    style={folder.is_active ? { boxShadow: "0 0 6px rgba(74,222,128,0.5)" } : undefined}
                  />

                  {/* Path + metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--aurora-text)] truncate font-mono">
                      {folder.folder_path}
                    </p>
                    {folder.last_scan_at && (
                      <p className="text-[10px] text-[var(--aurora-text-tertiary)] mt-0.5">
                        Last scan: {new Date(folder.last_scan_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleTriggerScan(folder.id)}
                      disabled={scanningId === folder.id}
                      className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors bg-white/[0.06] text-[var(--aurora-text-secondary)] hover:bg-white/[0.10] hover:text-[var(--aurora-text)] disabled:opacity-50"
                    >
                      {scanningId === folder.id ? "Scanning…" : "Scan now"}
                    </button>
                    <button
                      onClick={() => handleRemoveFolder(folder.id)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors bg-white/[0.06] text-[var(--aurora-text-tertiary)] hover:bg-[var(--aurora-danger)]/15 hover:text-[var(--aurora-danger)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".m3u,.m3u8,.json"
        className="hidden"
        onChange={handleImport}
      />

      {/* Dialogs */}
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <AddSongDialog open={addSongOpen} onOpenChange={setAddSongOpen} />

      {/* About / Updates */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <UpdateCard />
        <button
          onClick={() => checkForUpdates(true)}
          className="text-[12px] text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-accent-interactive)] transition-colors duration-150"
        >
          Check for updates
        </button>
        <button
          onClick={() => {
            resetWelcome()
            window.location.reload()
          }}
          className="text-[12px] text-[var(--aurora-text-tertiary)] hover:text-[var(--aurora-accent-interactive)] transition-colors duration-150"
        >
          Reset welcome screen
        </button>
      </div>
    </div>
  )
}
