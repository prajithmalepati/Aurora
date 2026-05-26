import type { ReactNode } from "react"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { AuroraCanvas } from '@/components/aurora/AuroraCanvas'

interface AppShellProps {
  children: {
    sidebar: ReactNode
    main: ReactNode
    playerBar: ReactNode
  }
  auroraColor1: [number, number, number]
  auroraColor2: [number, number, number]
  amplitude: number
  intensity: number
}

export function AppShell({ children, auroraColor1, auroraColor2, amplitude, intensity }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      {/* Fixed atmospheric layers — WebGL canvas, veil, then radial, then noise */}
      <AuroraCanvas color1={auroraColor1} color2={auroraColor2} amplitude={amplitude} intensity={intensity} />
      <div className="aurora-bg-veil" aria-hidden="true" />
      <div className="aurora-atmosphere" aria-hidden="true" />
      <div className="aurora-noise" aria-hidden="true" />

      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden h-9 w-9 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 aurora-focus"
        style={{
          background: "var(--aurora-surface-bar)",
          backdropFilter: "blur(12px)",
          boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
        }}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-3 z-10 h-7 w-7 rounded-md flex items-center justify-center text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 aurora-focus"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
        {children.sidebar}
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[240px_1fr] grid-rows-[1fr_auto] h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block overflow-y-auto aurora-keyline-right">
          {children.sidebar}
        </div>
        <div className="overflow-y-auto relative">
          <div className="aurora-scrim-top" aria-hidden="true" />
          {children.main}
        </div>
        <div className="md:col-span-2">{children.playerBar}</div>
      </div>
    </>
  )
}
