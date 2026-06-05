import { useSettingsStore } from "@/stores/settingsStore"
import type { CrossfadeCurve } from "@/stores/settingsStore"

export function SettingsView() {
  const crossfadeEnabled = useSettingsStore((s) => s.crossfadeEnabled)
  const crossfadeDuration = useSettingsStore((s) => s.crossfadeDuration)
  const crossfadeCurve = useSettingsStore((s) => s.crossfadeCurve)
  const replaygainMode = useSettingsStore((s) => s.replaygainMode)
  const setCrossfadeEnabled = useSettingsStore((s) => s.setCrossfadeEnabled)
  const setCrossfadeDuration = useSettingsStore((s) => s.setCrossfadeDuration)
  const setCrossfadeCurve = useSettingsStore((s) => s.setCrossfadeCurve)
  const setReplaygainMode = useSettingsStore((s) => s.setReplaygainMode)

  const durPct = ((crossfadeDuration - 1) / 11) * 100

  const durationPresets: { label: string; value: number }[] = [
    { label: "Short", value: 3 },
    { label: "Medium", value: 5 },
    { label: "Long", value: 8 },
    { label: "Extended", value: 12 },
  ]

  return (
    <div className="aurora-view-enter p-10 max-w-[600px]">
      <h1 className="font-display text-[36px] leading-none tracking-tight text-[var(--aurora-text)] mb-8">
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
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ${
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
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCrossfadeCurve(value)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
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

        {/* Manual skip info */}
        <div className="px-5 py-4 border-t border-[var(--aurora-rim)] flex items-center justify-between">
          <p className="text-[13px] text-[var(--aurora-text-secondary)]">Manual skip fade</p>
          <span className="text-[13px] tabular-nums text-[var(--aurora-text-tertiary)]">1s (fixed)</span>
        </div>
      </div>
    </div>
  )
}
