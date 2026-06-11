import { create } from "zustand"

export type CrossfadeCurve = "linear" | "equalpower" | "overlap" | "lagged"

interface SettingsState {
  crossfadeEnabled: boolean
  crossfadeDuration: number
  crossfadeCurve: CrossfadeCurve
  replaygainMode: "off" | "track" | "album"

  setCrossfadeEnabled: (enabled: boolean) => void
  setCrossfadeDuration: (seconds: number) => void
  setCrossfadeCurve: (curve: CrossfadeCurve) => void
  setReplaygainMode: (mode: "off" | "track" | "album") => void
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
  crossfadeDuration: load("aurora-xfade-duration", 5),
  crossfadeCurve: load<CrossfadeCurve>("aurora-xfade-curve", "equalpower"),
  replaygainMode: load<"off" | "track" | "album">("aurora-rg-mode", "track"),

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
}))
