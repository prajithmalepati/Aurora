import { toast } from "@/lib/toast"
import { openUrl } from "@tauri-apps/plugin-opener"

let startupCheckDone = false

/**
 * Check for app updates. Tries the native Tauri updater first;
 * on Linux deb installs (no APPIMAGE env), falls back to a
 * GitHub API version comparison.
 *
 * @param manual  true when triggered from the Settings button (shows errors)
 */
export async function checkForUpdates(manual: boolean): Promise<void> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater")
    const update = await check()
    if (update) {
      showUpdateToast(update.version, async () => {
        toast("Downloading update…")
        await update.downloadAndInstall()
        toast("Update installed — restart Aurora to apply")
      })
      return
    }
    // check() returned null — no update (or already latest)
    if (manual) {
      toast("You're on the latest version")
    }
  } catch {
    // Updater not available (Linux deb, no APPIMAGE) — try GitHub fallback
    await githubFallbackCheck(manual)
  }
}

/**
 * Linux deb fallback: compare running version against latest GitHub release.
 */
async function githubFallbackCheck(manual: boolean): Promise<void> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app")
    const current = await getVersion()

    const resp = await fetch(
      "https://api.github.com/repos/prajithmalepati/Aurora/releases/latest",
    )
    if (!resp.ok) {
      if (manual) toast("Could not check for updates")
      return
    }

    const data = await resp.json()
    const latest: string = data.tag_name ?? ""
    // Strip leading 'v' for comparison
    const latestClean = latest.replace(/^v/, "")
    const currentClean = current.replace(/^v/, "")

    if (latestClean && latestClean !== currentClean) {
      const htmlUrl: string = data.html_url ?? ""
      showUpdateToast(latestClean, async () => {
        // Open release page in system browser
        await openUrl(htmlUrl)
      })
    } else if (manual) {
      toast("You're on the latest version")
    }
  } catch {
    if (manual) toast("Could not check for updates")
  }
}

function showUpdateToast(version: string, onInstall: () => void) {
  toast(`Aurora ${version} is available`, {
    duration: 10000,
    action: { label: "Install", onClick: onInstall },
  })
}

/**
 * One-shot startup check. Call once from App.tsx after mount.
 * Delays 10s to avoid competing with cold-start I/O.
 */
export function scheduleStartupUpdateCheck(): void {
  if (startupCheckDone) return
  startupCheckDone = true
  setTimeout(() => {
    checkForUpdates(false)
  }, 10_000)
}
