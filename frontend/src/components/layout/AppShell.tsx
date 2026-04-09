import type { ReactNode } from "react"

interface AppShellProps {
  children: {
    sidebar: ReactNode
    main: ReactNode
    playerBar: ReactNode
  }
}

export function AppShell({ children }: AppShellProps) {
  return (
    <>
      {/* Fixed atmospheric layers — beneath everything, never interactive */}
      <div className="aurora-atmosphere" aria-hidden="true" />
      <div className="aurora-noise" aria-hidden="true" />

      <div className="relative z-10 grid grid-cols-[240px_1fr] grid-rows-[1fr_auto] h-screen overflow-hidden">
        <div className="overflow-y-auto aurora-keyline-right">
          {children.sidebar}
        </div>
        <div className="overflow-y-auto relative">
          {/* Top scrim — soft fade into black at the content edge */}
          <div
            className="pointer-events-none sticky top-0 h-6 -mb-6 z-20"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
            }}
            aria-hidden="true"
          />
          {children.main}
        </div>
        <div className="col-span-2">{children.playerBar}</div>
      </div>
    </>
  )
}
