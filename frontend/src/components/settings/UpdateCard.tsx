import { useUpdateStore } from "@/stores/updateStore"
import { checkForUpdates } from "@/lib/updater"
import { Download, RefreshCw } from "lucide-react"

export function UpdateCard() {
  const status = useUpdateStore((s) => s.status)
  const availableVersion = useUpdateStore((s) => s.availableVersion)

  if (status === "idle" || status === "error") return null

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{
        background: "var(--aurora-surface)",
        border: "1px solid var(--aurora-rim)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Aurora icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--aurora-accent-interactive-glow), var(--aurora-secondary-glow))",
          }}
        >
          {status === "downloading" ? (
            <RefreshCw className="h-4 w-4 text-[var(--aurora-accent-interactive)] animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-[var(--aurora-accent-interactive)]" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[var(--aurora-text)] font-medium">
            {status === "available" && `Aurora ${availableVersion} is ready`}
            {status === "downloading" && `Downloading Aurora ${availableVersion}…`}
            {status === "installed" && "Update installed"}
          </p>
          <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">
            {status === "available" && "A new version is available."}
            {status === "downloading" && "Please wait…"}
            {status === "installed" && "Restart Aurora to finish."}
          </p>
        </div>

        {/* Action button */}
        {status === "available" && (
          <button
            onClick={() => checkForUpdates(false)}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors bg-[var(--aurora-accent-interactive)] text-[var(--aurora-obsidian)] hover:opacity-90 active:opacity-80 flex-shrink-0"
          >
            Install
          </button>
        )}
        {/* Restart: @tauri-apps/plugin-process not installed —
            no relaunch() available. Instructional copy only. */}
      </div>
    </div>
  )
}
