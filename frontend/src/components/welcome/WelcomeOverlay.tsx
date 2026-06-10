import { useState } from "react"
import { FolderSearch, Music, Keyboard } from "lucide-react"
import { motion } from "motion/react"
import { AuroraWordmark } from "@/components/aurora/AuroraWordmark"
import { ScanDialog } from "@/components/scanner/ScanDialog"
import { AddSongDialog } from "@/components/songs/AddSongDialog"
import { KeyboardShortcutsOverlay } from "@/components/ui/KeyboardShortcutsOverlay"

const WELCOME_DISMISSED_KEY = "aurora-welcome-dismissed"

export function dismissWelcome() {
  localStorage.setItem(WELCOME_DISMISSED_KEY, "1")
}

export function resetWelcome() {
  localStorage.removeItem(WELCOME_DISMISSED_KEY)
}

export function isWelcomeDismissed(): boolean {
  return localStorage.getItem(WELCOME_DISMISSED_KEY) === "1"
}

export function WelcomeOverlay() {
  const [scanOpen, setScanOpen] = useState(false)
  const [addSongOpen, setAddSongOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <>
      <div className="relative flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <motion.div
            className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, rgba(45, 212, 191, 0.12), transparent 70%)" }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.5, 0.65, 0.5],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-1/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[100px]"
            style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.08), transparent 70%)" }}
            animate={{
              scale: [1.05, 1, 1.05],
              opacity: [0.4, 0.55, 0.4],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
          <motion.div
            className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] rounded-full blur-[90px]"
            style={{ background: "radial-gradient(circle, rgba(45, 212, 191, 0.06), transparent 70%)" }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
        </div>

        {/* Content */}
        <motion.div
          className="flex flex-col items-center text-center max-w-[520px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Aurora logo */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <AuroraWordmark className="h-8 w-auto" />
          </motion.div>

          {/* Heading */}
          <motion.h1
            className="font-display text-[32px] leading-tight tracking-tight text-[var(--aurora-text)] mb-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Welcome to Aurora
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-[14px] text-[var(--aurora-text-secondary)] mb-10 max-w-[360px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Your personal offline music library
          </motion.p>

          {/* Action cards */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {/* Card 1: Scan Folder */}
            <button
              onClick={() => setScanOpen(true)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl text-left transition-[color,background-color,border-color,box-shadow] duration-200 group"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 group-hover:bg-[var(--aurora-accent-interactive)]/20"
                style={{ background: "rgba(255, 255, 255, 0.06)" }}
              >
                <FolderSearch
                  className="h-5 w-5 text-[var(--aurora-text-secondary)] group-hover:text-[var(--aurora-accent-interactive)] transition-colors duration-200"
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium text-[var(--aurora-text)] mb-1">
                  Scan a Music Folder
                </p>
                <p className="text-[11px] text-[var(--aurora-text-tertiary)] leading-relaxed">
                  Import your local music collection
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--aurora-accent-interactive)] group-hover:underline">
                Scan Folder
              </span>
            </button>

            {/* Card 2: Add Song */}
            <button
              onClick={() => setAddSongOpen(true)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl text-left transition-[color,background-color,border-color,box-shadow] duration-200 group"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 group-hover:bg-[var(--aurora-accent-interactive)]/20"
                style={{ background: "rgba(255, 255, 255, 0.06)" }}
              >
                <Music
                  className="h-5 w-5 text-[var(--aurora-text-secondary)] group-hover:text-[var(--aurora-accent-interactive)] transition-colors duration-200"
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium text-[var(--aurora-text)] mb-1">
                  Add a Song Manually
                </p>
                <p className="text-[11px] text-[var(--aurora-text-tertiary)] leading-relaxed">
                  Add individual tracks with custom tags
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--aurora-accent-interactive)] group-hover:underline">
                Add Song
              </span>
            </button>

            {/* Card 3: View Shortcuts */}
            <button
              onClick={() => setShortcutsOpen(true)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl text-left transition-[color,background-color,border-color,box-shadow] duration-200 group"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 group-hover:bg-[var(--aurora-accent-interactive)]/20"
                style={{ background: "rgba(255, 255, 255, 0.06)" }}
              >
                <Keyboard
                  className="h-5 w-5 text-[var(--aurora-text-secondary)] group-hover:text-[var(--aurora-accent-interactive)] transition-colors duration-200"
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium text-[var(--aurora-text)] mb-1">
                  Learn Keyboard Shortcuts
                </p>
                <p className="text-[11px] text-[var(--aurora-text-tertiary)] leading-relaxed">
                  Master Aurora with 16 shortcuts
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--aurora-accent-interactive)] group-hover:underline">
                View Shortcuts
              </span>
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Dialogs */}
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <AddSongDialog open={addSongOpen} onOpenChange={setAddSongOpen} />
      <KeyboardShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
