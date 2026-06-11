import { useState, useEffect, useCallback } from "react"
import { useSettingsStore } from "@/stores/settingsStore"
import type { CrossfadeCurve } from "@/stores/settingsStore"
import { resetWelcome } from "@/components/welcome/WelcomeOverlay"
import { api } from "@/lib/api"
import { toast } from "@/lib/toast"
import type { WatchedFolder } from "@/types"
import type { ApiResponse } from "@/types"

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

      {/* Audio section */}
      <div
        className="rounded-xl overflow-hidden"
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
              { value: "linear" as CrossfadeCurve, label: "Linear" },
              { value: "equalpower" as CrossfadeCurve, label: "Equal Power" },
              { value: "overlap" as CrossfadeCurve, label: "Overlap" },
              { value: "lagged" as CrossfadeCurve, label: "Lagged" },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCrossfadeCurve(value)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors active:bg-white/[0.03] ${
                  crossfadeCurve === value
                    ? "bg-[var(--aurora-accent-interactive)] text-white"
                    : "bg-white/[0.08] text-[var(--aurora-text-secondary)] hover:bg-white/[0.12]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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

      {/* Reset welcome */}
      <div className="mt-8 text-center">
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
