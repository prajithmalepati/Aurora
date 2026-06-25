import { create } from "zustand"

export type CrossfadeCurve = "linear" | "equalpower" | "overlap" | "lagged"

interface SettingsState {
  crossfadeEnabled: boolean
  crossfadeDuration: number
  crossfadeCurve: CrossfadeCurve
  replaygainMode: "off" | "track" | "album"
  respectTrims: boolean
  zoomLevel: number

  setCrossfadeEnabled: (enabled: boolean) => void
  setCrossfadeDuration: (seconds: number) => void
  setCrossfadeCurve: (curve: CrossfadeCurve) => void
  setReplaygainMode: (mode: "off" | "track" | "album") => void
  setRespectTrims: (respect: boolean) => void
  setZoomLevel: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  applyZoom: () => void
}

async function applyWebviewZoom(level: number) {
  try {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview")
    await getCurrentWebview().setZoom(level / 100)
  } catch {
    // not running under Tauri (dev browser) or capability not granted — no-op
  }
}

function snapZoom(level: number): number {
  const clamped = Math.max(70, Math.min(130, level))
  return Math.round(clamped / 10) * 10
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  crossfadeEnabled: load("aurora-xfade-enabled", true),
  crossfadeDuration: Math.max(1, Math.min(12, load("aurora-xfade-duration", 5))),
  crossfadeCurve: (() => {
    const raw = load<string>("aurora-xfade-curve", "equalpower")
    const valid: CrossfadeCurve[] = ["linear", "equalpower", "overlap", "lagged"]
    return valid.includes(raw as CrossfadeCurve) ? (raw as CrossfadeCurve) : "equalpower"
  })(),
  replaygainMode: load<"off" | "track" | "album">("aurora-rg-mode", "track"),
  respectTrims: load("aurora-respect-trims", true),

  setCrossfadeEnabled: (enabled) => {
    localStorage.setItem("aurora-xfade-enabled", JSON.stringify(enabled))
    set({ crossfadeEnabled: enabled })
  },

  setCrossfadeDuration: (seconds) => {
    const clamped = Math.max(1, Math.min(12, seconds))
    localStorage.setItem("aurora-xfade-duration", JSON.stringify(clamped))
    set({ crossfadeDuration: clamped })
  },

  setCrossfadeCurve: (curve) => {
    localStorage.setItem("aurora-xfade-curve", JSON.stringify(curve))
    set({ crossfadeCurve: curve })
  },

  setReplaygainMode: (mode) => {
    localStorage.setItem("aurora-rg-mode", JSON.stringify(mode))
    set({ replaygainMode: mode })
  },

  setRespectTrims: (respect) => {
    localStorage.setItem("aurora-respect-trims", JSON.stringify(respect))
    set({ respectTrims: respect })
  },

  zoomLevel: snapZoom(load("aurora-zoom", 100)),

  setZoomLevel: (level) => {
    const snapped = snapZoom(level)
    localStorage.setItem("aurora-zoom", JSON.stringify(snapped))
    set({ zoomLevel: snapped })
    applyWebviewZoom(snapped)
  },

  zoomIn: () => {
    const current = useSettingsStore.getState().zoomLevel
    const next = snapZoom(current + 10)
    localStorage.setItem("aurora-zoom", JSON.stringify(next))
    set({ zoomLevel: next })
    applyWebviewZoom(next)
  },

  zoomOut: () => {
    const current = useSettingsStore.getState().zoomLevel
    const next = snapZoom(current - 10)
    localStorage.setItem("aurora-zoom", JSON.stringify(next))
    set({ zoomLevel: next })
    applyWebviewZoom(next)
  },

  zoomReset: () => {
    localStorage.setItem("aurora-zoom", JSON.stringify(100))
    set({ zoomLevel: 100 })
    applyWebviewZoom(100)
  },

  applyZoom: () => {
    const level = useSettingsStore.getState().zoomLevel
    applyWebviewZoom(level)
  },
}))
