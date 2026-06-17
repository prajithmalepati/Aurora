import { AuroraWordmark } from "@/components/aurora/AuroraWordmark"
import { ExternalLink, Bug } from "lucide-react"

// Platform detection for keyboard shortcuts
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? "⌘" : "Ctrl"

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
  { expression: "rock", meaning: "Songs tagged \"rock\"" },
  { expression: "rock AND japanese", meaning: "Both tags" },
  { expression: "rock OR pop", meaning: "Either tag" },
  { expression: "NOT jazz", meaning: "Exclude jazz" },
  { expression: "(anime OR game) AND instrumental", meaning: "Grouped logic" },
]

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

export function AboutView() {
  return (
    <div className="aurora-view-enter p-4 sm:p-10 max-w-[680px] mx-auto">
      {/* Header: Logo + version */}
      <div className="flex items-end gap-4 mb-2">
        <AuroraWordmark className="h-7" />
        <span
          className="pb-1 text-[13px] font-medium tracking-wide"
          style={{ color: "var(--aurora-text-tertiary)" }}
        >
          v1.0
        </span>
      </div>

      {/* Tagline */}
      <p
        className="text-[15px] mb-10 font-display-italic"
        style={{ color: "var(--aurora-text-secondary)" }}
      >
        A beautiful offline music library
      </p>

      {/* Credits */}
      <Section title="Built With">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {[
            "React 19",
            "FastAPI",
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

      {/* Keyboard Shortcuts */}
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

      {/* Filter Syntax Guide */}
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

      {/* Links */}
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
        </div>
      </Section>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
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
