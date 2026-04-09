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
    <div className="grid grid-cols-[240px_1fr] grid-rows-[1fr_auto] h-screen bg-[var(--aurora-bg-deep)] overflow-hidden">
      <div className="overflow-y-auto">{children.sidebar}</div>
      <div className="overflow-y-auto">{children.main}</div>
      <div className="col-span-2">{children.playerBar}</div>
    </div>
  )
}