import { create } from "zustand"

export type UpdateStatus = "idle" | "available" | "downloading" | "installed" | "error"

interface UpdateState {
  status: UpdateStatus
  availableVersion: string | null

  setAvailable: (version: string) => void
  setDownloading: () => void
  setInstalled: () => void
  setError: () => void
  reset: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: "idle",
  availableVersion: null,

  setAvailable: (version) => set({ status: "available", availableVersion: version }),
  setDownloading: () => set({ status: "downloading" }),
  setInstalled: () => set({ status: "installed" }),
  setError: () => set({ status: "error", availableVersion: null }),
  reset: () => set({ status: "idle", availableVersion: null }),
}))
