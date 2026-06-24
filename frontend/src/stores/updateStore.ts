import { create } from "zustand"

export type UpdateStatus = "idle" | "available" | "downloading" | "installed" | "error"

interface UpdateState {
  status: UpdateStatus
  availableVersion: string | null
  /** Runs the real install for the current update:
   *  native downloadAndInstall, or open-release-page on the Linux/GitHub path.
   *  Set when an update is found; null otherwise. */
  install: (() => Promise<void>) | null

  setAvailable: (version: string, install: () => Promise<void>) => void
  setDownloading: () => void
  setInstalled: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: "idle",
  availableVersion: null,
  install: null,

  setAvailable: (version, install) =>
    set({ status: "available", availableVersion: version, install }),
  setDownloading: () => set({ status: "downloading" }),
  setInstalled: () => set({ status: "installed", install: null }),
}))
