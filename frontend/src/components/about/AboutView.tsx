import { useEffect, useState } from "react"
import { AuroraWordmark } from "@/components/aurora/AuroraWordmark"
import { ExternalLink, Bug, ClipboardCheck, Download } from "lucide-react"
import { getBaseUrl } from "@/lib/api"
import { checkForUpdates } from "@/lib/updater"
import { useUpdateStore } from "@/stores/updateStore"

// Platform detection for keyboard shortcuts
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? "⌘" : "Ctrl"

// ── Data dir / log path (platform-detected) ───────────────────────────
const isWindows =
  typeof navigator !== "undefined" && /Win/.test(navigator.platform)
const dataDir = isWindows
  ? "%LOCALAPPDATA%\\Aurora\\Aurora"
  : "~/.local/share/Aurora"
const logPath = isWindows
  ? `${dataDir}\\aurora.log`
  : `${dataDir}/aurora.log`

// ── Health response type ──────────────────────────────────────────────
interface HealthData {
  status: string
  database: string
  song_count: number
  tag_count: number
  playlist_count: number
  db_path: string
  data_dir: string
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
interface ShortcutEntry {
  keys: string
  action: string
}
interface ShortcutCategory {
  name: string
  shortcuts: ShortcutEntry[]
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: "Playback",
    shortcuts: [
      { keys: "Space", action: "Play / Pause" },
      { keys: "N", action: "Next song" },
      { keys: "P", action: "Previous song" },
      { keys: "M", action: "Mute / Unmute" },
      { keys: "[", action: "Volume −5%" },
      { keys: "]", action: "Volume +5%" },
    ],
  },
  {
    name: "Queue",
    shortcuts: [
      { keys: "L", action: "Toggle shuffle" },
      { keys: "R", action: "Cycle repeat (off → all → one)" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: "/", action: "Focus search" },
      { keys: `${mod} + F`, action: "Focus search" },
      { keys: `${mod} + K`, action: "Command palette" },
      { keys: `${mod} + Shift + F`, action: "Toggle fullscreen" },
      { keys: "S", action: "Toggle Settings" },
      { keys: "1 — 9", action: "Quick playlist switch" },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { keys: "?", action: "Show keyboard shortcuts" },
      { keys: "Esc", action: "Close dialogs" },
    ],
  },
]

const filterExamples: { expression: string; meaning: string }[] = [
  { expression: "rock", meaning: 'Songs tagged "rock"' },
  { expression: "rock AND japanese", meaning: "Both tags" },
  { expression: "rock OR pop", meaning: "Either tag" },
  { expression: "NOT jazz", meaning: "Exclude jazz" },
  { expression: "(anime OR game) AND instrumental", meaning: "Grouped logic" },
]

// ── Shared UI atoms ───────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-mono font-medium leading-relaxed"
      style={{
        background: "var(--aurora-surface)",
        boxShadow: "inset 0 -1px 0 var(--aurora-rim), 0 1px 0 var(--aurora-rim)",
        color: "var(--aurora-text-secondary)",
        minWidth: "1.6em",
      }}
    >
      {children}
    </kbd>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-10">
      <h2
        className="font-display text-[20px] leading-none tracking-tight mb-4"
        style={{ color: "var(--aurora-text)" }}
      >
        {title}
      </h2>
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--aurora-surface)",
          border: "1px solid var(--aurora-rim)",
          backdropFilter: "blur(12px)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: "ok" | "degraded" | "unreachable" }) {
  const color =
    status === "ok"
      ? "#22c55e"
      : status === "degraded"
        ? "#f59e0b"
        : "#ef4444"
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  )
}

function CopyButton({ onCopy }: { onCopy: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-[13px] font-medium rounded-lg px-4 py-2 transition-all duration-150 cursor-pointer"
      style={{
        background: copied
          ? "rgba(34,197,94,0.15)"
          : "var(--aurora-surface)",
        border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "var(--aurora-rim)"}`,
        color: copied
          ? "#22c55e"
          : "var(--aurora-text-secondary)",
      }}
    >
      {copied ? (
        <>
          <ClipboardCheck className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardCheck className="h-4 w-4" />
          Copy diagnostics to clipboard
        </>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────
export function AboutView() {
  const [appVersion, setAppVersion] = useState<string>("")
  const [health, setHealth] = useState<HealthData | null>(null)
  const [healthStatus, setHealthStatus] = useState<"ok" | "degraded" | "unreachable">("unreachable")
  const [checking, setChecking] = useState(false)

  const updateStatus = useUpdateStore((s) => s.status)
  const availableVersion = useUpdateStore((s) => s.availableVersion)
  const installUpdate = useUpdateStore((s) => s.install)

  // Fetch app version
  useEffect(() => {
    async function fetchVersion() {
      try {
        const { getVersion } = await import("@tauri-apps/api/app")
        setAppVersion(await getVersion())
      } catch {
        // Dev mode fallback
        setAppVersion(import.meta.env.VITE_APP_VERSION || "dev")
      }
    }
    fetchVersion()
  }, [])

  // Fetch health
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/health`)
        if (!res.ok) throw new Error("not ok")
        const data: HealthData = await res.json()
        setHealth(data)
        setHealthStatus(data.status === "ok" ? "ok" : "degraded")
      } catch {
        setHealthStatus("unreachable")
      }
    }
    fetchHealth()
  }, [])

  const handleCheckUpdates = async () => {
    setChecking(true)
    try {
      await checkForUpdates(true)
    } finally {
      setChecking(false)
    }
  }

  const handleCopyDiagnostics = async () => {
    const os = isWindows ? "Windows" : /Mac/.test(navigator.platform) ? "macOS" : "Linux"
    const lines = [
      `Aurora ${appVersion || "unknown"}`,
      `Backend: ${healthStatus}`,
      health ? `Songs: ${health.song_count}` : "Songs: N/A",
      `OS: ${os}`,
      health ? `DB: ${health.db_path}` : `DB: ${dataDir}/aurora.db`,
      health ? `Data dir: ${health.data_dir}` : `Data dir: ${dataDir}`,
    ]
    await navigator.clipboard.writeText(lines.join("\n"))
  }

  return (
    <div className="aurora-view-enter p-4 sm:p-10 max-w-[680px] mx-auto">
      {/* Header: Logo + version */}
      <div className="flex items-end gap-4 mb-2">
        <AuroraWordmark className="h-7" />
        <span
          className="pb-1 text-[13px] font-medium tracking-wide"
          style={{ color: "var(--aurora-text-tertiary)" }}
        >
          v{appVersion || "..."}
        </span>
      </div>

      {/* Tagline */}
      <p
        className="text-[15px] mb-10 font-display-italic"
        style={{ color: "var(--aurora-text-secondary)" }}
      >
        A beautiful offline music library
      </p>

      {/* ── System card ──────────────────────────────────────── */}
      <Section title="System">
        <div className="flex flex-col gap-3">
          {/* App version */}
          <div className="flex items-center justify-between">
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-tertiary)" }}
            >
              App version
            </span>
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--aurora-text-secondary)" }}
            >
              {appVersion || "..."}
            </span>
          </div>

          {/* Backend status */}
          <div className="flex items-center justify-between">
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-tertiary)" }}
            >
              Backend
            </span>
            <span className="flex items-center gap-2 text-[13px]">
              <StatusDot status={healthStatus} />
              <span
                style={{ color: "var(--aurora-text-secondary)" }}
              >
                {healthStatus === "ok"
                  ? "Running"
                  : healthStatus === "degraded"
                    ? "Degraded"
                    : "Unreachable"}
              </span>
            </span>
          </div>

          {/* Database / song count */}
          <div className="flex items-center justify-between">
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-tertiary)" }}
            >
              Library
            </span>
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-secondary)" }}
            >
              {health
                ? `${health.song_count.toLocaleString()} song${health.song_count !== 1 ? "s" : ""}`
                : "—"}
            </span>
          </div>

          {/* Update status */}
          {updateStatus === "available" && availableVersion && (
            <div className="flex items-center justify-between">
              <span
                className="text-[13px]"
                style={{ color: "var(--aurora-text-tertiary)" }}
              >
                Update
              </span>
              <span className="flex items-center gap-3">
                <span
                  className="text-[13px]"
                  style={{ color: "var(--aurora-accent-interactive)" }}
                >
                  v{availableVersion} available
                </span>
                {installUpdate && (
                  <button
                    onClick={() => installUpdate()}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md px-3 py-1 transition-colors duration-150 cursor-pointer"
                    style={{
                      background: "rgba(94,234,212,0.12)",
                      border: "1px solid rgba(94,234,212,0.25)",
                      color: "var(--aurora-accent-interactive)",
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Check for updates button */}
          <div className="pt-2">
            <button
              onClick={handleCheckUpdates}
              disabled={checking}
              className="text-[13px] font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50"
              style={{
                color: "var(--aurora-accent-interactive)",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              {checking ? "Checking…" : "Check for updates"}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Built With ───────────────────────────────────────── */}
      <Section title="Built With">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {[
            "React 19",
            "Rust (axum)",
            "Howler.js",
            "shadcn/ui",
            "Zustand",
            "Tailwind CSS",
            "TypeScript",
            "Vite",
            "SQLite",
          ].map((tech) => (
            <span
              key={tech}
              className="text-[13px]"
              style={{ color: "var(--aurora-text-secondary)" }}
            >
              {tech}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Keyboard Shortcuts ────────────────────────────────── */}
      <Section title="Keyboard Shortcuts">
        <div className="flex flex-col gap-5">
          {shortcutCategories.map((cat) => (
            <div key={cat.name}>
              <h3
                className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2.5"
                style={{ color: "var(--aurora-text-tertiary)" }}
              >
                {cat.name}
              </h3>
              <div className="flex flex-col gap-2">
                {cat.shortcuts.map((entry) => (
                  <div
                    key={entry.action}
                    className="flex items-center justify-between gap-4"
                  >
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--aurora-text-secondary)" }}
                    >
                      {entry.action}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {entry.keys.split(" + ").map((part, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{part}</Kbd>
                          {i < entry.keys.split(" + ").length - 1 && (
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--aurora-text-tertiary)" }}
                            >
                              +
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p
          className="mt-5 text-[12px]"
          style={{ color: "var(--aurora-text-tertiary)" }}
        >
          Press <Kbd>?</Kbd> any time to open the shortcuts overlay
        </p>
      </Section>

      {/* ── Filter Syntax ─────────────────────────────────────── */}
      <Section title="Filter Syntax">
        <p
          className="text-[13px] mb-4"
          style={{ color: "var(--aurora-text-secondary)" }}
        >
          Aurora uses a boolean tag filter with AND, OR, NOT, and parentheses. Type
          queries directly in the Mix view.
        </p>
        <div className="flex flex-col gap-2">
          {filterExamples.map((ex) => (
            <div
              key={ex.expression}
              className="flex items-center gap-3"
            >
              <code
                className="text-[13px] font-mono px-2 py-1 rounded-md flex-shrink-0"
                style={{
                  background: "var(--aurora-surface)",
                  color: "var(--aurora-accent-interactive)",
                }}
              >
                {ex.expression}
              </code>
              <span
                className="text-[13px]"
                style={{ color: "var(--aurora-text-secondary)" }}
              >
                {ex.meaning}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Links ──────────────────────────────────────────────── */}
      <Section title="Links">
        <div className="flex flex-col gap-3">
          <a
            href="https://github.com/prajithmalepati/Aurora"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 w-fit text-[13px] transition-colors duration-150"
            style={{ color: "var(--aurora-text-secondary)" }}
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
            <span className="group-hover:text-[var(--aurora-accent-interactive)] transition-colors">
              github.com/prajithmalepati/Aurora
            </span>
            <ExternalLink
              className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
              style={{ color: "var(--aurora-text-tertiary)" }}
            />
          </a>
          <a
            href="https://github.com/prajithmalepati/Aurora/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 w-fit text-[13px] transition-colors duration-150"
            style={{ color: "var(--aurora-text-secondary)" }}
          >
            <Bug className="h-4 w-4" strokeWidth={1.5} />
            <span className="group-hover:text-[var(--aurora-accent-interactive)] transition-colors">
              Report an Issue
            </span>
            <ExternalLink
              className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
              style={{ color: "var(--aurora-text-tertiary)" }}
            />
          </a>
          <a
            href="https://github.com/prajithmalepati/Aurora/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 w-fit text-[13px] transition-colors duration-150"
            style={{ color: "var(--aurora-text-secondary)" }}
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
            <span className="group-hover:text-[var(--aurora-accent-interactive)] transition-colors">
              Changelog
            </span>
            <ExternalLink
              className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
              style={{ color: "var(--aurora-text-tertiary)" }}
            />
          </a>
        </div>
      </Section>

      {/* ── Diagnostics ────────────────────────────────────────── */}
      <Section title="Diagnostics">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-tertiary)" }}
            >
              Data directory
            </span>
            <span
              className="text-[13px] font-mono"
              style={{ color: "var(--aurora-text-secondary)" }}
            >
              {health ? health.data_dir : dataDir}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className="text-[13px]"
              style={{ color: "var(--aurora-text-tertiary)" }}
            >
              Log file
            </span>
            <span
              className="text-[13px] font-mono"
              style={{ color: "var(--aurora-text-secondary)" }}
            >
              {logPath}
            </span>
          </div>
          <div className="pt-2">
            <CopyButton onCopy={handleCopyDiagnostics} />
          </div>
        </div>
      </Section>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  )
}
