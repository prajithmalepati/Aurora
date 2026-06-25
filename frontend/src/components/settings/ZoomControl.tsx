import { useSettingsStore } from "@/stores/settingsStore"

export function ZoomControl() {
  const zoomLevel = useSettingsStore((s) => s.zoomLevel)
  const zoomIn = useSettingsStore((s) => s.zoomIn)
  const zoomOut = useSettingsStore((s) => s.zoomOut)
  const zoomReset = useSettingsStore((s) => s.zoomReset)

  const atMin = zoomLevel <= 70
  const atMax = zoomLevel >= 130
  const atDefault = zoomLevel === 100

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={zoomOut}
        disabled={atMin}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--aurora-text-secondary)] hover:bg-white/[0.03] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Zoom out"
      >
        −
      </button>
      <span className="text-[13px] tabular-nums text-[var(--aurora-accent-interactive)] font-medium w-10 text-center">
        {zoomLevel}%
      </span>
      <button
        onClick={zoomIn}
        disabled={atMax}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--aurora-text-secondary)] hover:bg-white/[0.03] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Zoom in"
      >
        +
      </button>
      {!atDefault && (
        <button
          onClick={zoomReset}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--aurora-text-tertiary)] hover:bg-white/[0.03] hover:text-[var(--aurora-text-secondary)] transition-colors"
          aria-label="Reset zoom to 100%"
        >
          ↺
        </button>
      )}
    </div>
  )
}
