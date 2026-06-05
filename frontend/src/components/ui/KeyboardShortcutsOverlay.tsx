import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Platform detection
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? "⌘" : "Ctrl"

interface ShortcutEntry {
  keys: string
  action: string
}

interface Category {
  name: string
  shortcuts: ShortcutEntry[]
}

const categories: Category[] = [
  {
    name: "Playback",
    shortcuts: [
      { keys: "Space", action: "Play / Pause" },
      { keys: isMac ? "←" : "←  →", action: isMac ? "Seek backward / forward (5s)" : "Seek backward / forward (5s)" },
      { keys: "N", action: "Next song" },
      { keys: "P", action: "Previous song" },
      { keys: "[", action: "Volume down 5%" },
      { keys: "]", action: "Volume up 5%" },
      { keys: "M", action: "Mute / Unmute" },
    ],
  },
  {
    name: "Queue",
    shortcuts: [
      { keys: "L", action: "Toggle shuffle" },
      { keys: "R", action: "Cycle repeat mode (off → all → one)" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: `${mod} + F`, action: "Focus Mix search" },
      { keys: `${mod} + K`, action: "Command palette" },
      { keys: "1 — 9", action: "Quick switch to playlist" },
      { keys: "/", action: "Focus Mix query bar" },
      { keys: "S", action: "Toggle settings panel" },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { keys: "?", action: "Show keyboard shortcuts" },
      { keys: "Esc", action: "Close panel / blur input" },
      { keys: `${mod} + Shift + F`, action: "Toggle fullscreen" },
    ],
  },
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

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {categories.map((cat) => (
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
                    className="flex items-center justify-between"
                  >
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--aurora-text-secondary)" }}
                    >
                      {entry.action}
                    </span>
                    <span className="flex items-center gap-1">
                      {entry.keys.split(" + ").map((part, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{part}</Kbd>
                          {i < entry.keys.split(" + ").length - 1 && (
                            <span className="text-[10px] text-[var(--aurora-text-tertiary)]">
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

        <div
          className="mt-2 pt-3 border-t text-[11px] text-center"
          style={{
            borderColor: "var(--aurora-rim)",
            color: "var(--aurora-text-tertiary)",
          }}
        >
          Press <Kbd>?</Kbd> any time to open this overlay
        </div>
      </DialogContent>
    </Dialog>
  )
}
