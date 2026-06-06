import { useEffect, useState, type ReactNode } from "react"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { KeyboardShortcutsOverlay } from "@/components/ui/KeyboardShortcutsOverlay"
import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { PlayerBar } from "@/components/layout/PlayerBar"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"
import { Toaster } from "sonner"
import { ToastClickDismiss } from "@/components/ui/ToastClickDismiss"
import { SongTable } from "@/components/songs/SongTable"
import { PlaylistDetail } from "@/components/playlists/PlaylistDetail"
import { QueryBuilder } from "@/components/filter/QueryBuilder"
import { SettingsView } from "@/components/settings/SettingsView"
import { FoldersView } from "@/components/folders/FoldersView"
import { AboutView } from "@/components/about/AboutView"
import { AnimatePresence, motion } from "motion/react"
import { AuroraColorBridge } from '@/components/aurora/AuroraColorBridge'
import { WelcomeOverlay, dismissWelcome, isWelcomeDismissed } from "@/components/welcome/WelcomeOverlay"
import { Search, Shuffle } from "lucide-react"
import type { Song } from "@/types"

function App() {
  const [searchQuery, setSearchQuery] = useState("")

  const fetchSongs = useSongStore((state) => state.fetchSongs)
  const songs = useSongStore((state) => state.songs)
  const songsLoading = useSongStore((state) => state.loading)
  const songsError = useSongStore((state) => state.error)
  const view = useSongStore((state) => state.view)
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)
  const fetchTags = useTagStore((state) => state.fetchTags)
  const playSong = usePlayerStore((state) => state.playSong)

  useEffect(() => {
    fetchSongs()
    fetchPlaylists()
    fetchTags()
  }, [fetchSongs, fetchPlaylists, fetchTags])

  // Debounced search handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchSongs(searchQuery)
      } else {
        fetchSongs()
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, fetchSongs])

  const isPlaying = usePlayerStore((state) => state.isPlaying)

  // Wake lock — prevent tab suspension while audio plays
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null

    async function requestWakeLock() {
      if ("wakeLock" in navigator && isPlaying) {
        try {
          wakeLock = await navigator.wakeLock.request("screen")
        } catch {
          // Wake lock request can fail (e.g. tab not visible)
        }
      }
    }

    if (isPlaying) {
      requestWakeLock()
    }

    return () => {
      wakeLock?.release()
    }
  }, [isPlaying])

  // Dismiss welcome overlay once songs exist
  useEffect(() => {
    if (songs.length > 0 && !songsLoading) {
      dismissWelcome()
    }
  }, [songs.length, songsLoading])

  // Global keyboard shortcuts
  const { isOverlayOpen, closeOverlay } = useKeyboardShortcuts()

  const handlePlaySong = (song: Song) => {
    playSong(song, songs)
  }

  const renderMainContent = () => {
    // Show welcome overlay when library is empty and not yet dismissed
    if (songs.length === 0 && !songsLoading && !isWelcomeDismissed()) {
      return <WelcomeOverlay />
    }

    let content: ReactNode
    if (view.kind === "all-songs") {
      content = (
        <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)]">
              All Songs
            </h1>
            <button
              onClick={() => {
                const shuffled = [...songs].sort(() => Math.random() - 0.5)
                if (shuffled.length > 0) {
                  usePlayerStore.getState().playSong(shuffled[0], shuffled)
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
              style={{ background: "var(--aurora-surface)", boxShadow: "inset 0 0 0 1px var(--aurora-rim)" }}
              aria-label="Shuffle all songs"
            >
              <Shuffle className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Shuffle</span>
            </button>
            <span className="label-micro text-[var(--aurora-text-secondary)]">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </span>
          </div>
          <div
            className="relative flex items-center rounded-full mb-6 transition-all duration-200 focus-within:shadow-[0_0_20px_-6px_var(--aurora-glow)]"
            style={{
              background: "var(--aurora-surface)",
              boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <Search
              className="absolute left-4 h-3.5 w-3.5 text-[var(--aurora-text-tertiary)] pointer-events-none"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search titles, artists, albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-none pl-11 pr-5 py-2.5 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic placeholder:text-[14px]"
            />
          </div>
          <SongTable songs={songs} loading={songsLoading} error={songsError} onPlay={handlePlaySong} />
        </div>
      )
    } else if (view.kind === "filter") {
      content = <QueryBuilder />
    } else if (view.kind === "playlist") {
      content = <PlaylistDetail key={view.playlistId} playlistId={view.playlistId} />
    } else if (view.kind === "folders") {
      content = <FoldersView />
    } else if (view.kind === "about") {
      content = <AboutView />
    } else {
      content = <SettingsView />
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={view.kind === "playlist" ? `playlist-${view.playlistId}` : view.kind}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <>
      <AuroraColorBridge />
      <ErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center h-screen gap-4 p-10 bg-[var(--aurora-obsidian)]">
            <p className="font-display text-[24px] text-[var(--aurora-text)]">
              Something went wrong
            </p>
            <p className="text-[13px] text-[var(--aurora-text-secondary)]">
              An unexpected error occurred. Please reload the app.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-5 py-2 rounded-full text-[12px] font-semibold aurora-btn-press"
              style={{
                background: "var(--aurora-accent-interactive)",
                color: "var(--aurora-slate)",
              }}
            >
              Reload App
            </button>
          </div>
        }
      >
        <AppShell
          children={{
            sidebar: <Sidebar currentView={view} onViewChange={setView} />,
            main: <ErrorBoundary>{renderMainContent()}</ErrorBoundary>,
            playerBar: <PlayerBar />,
          }}
        />
      </ErrorBoundary>
      <Toaster
        position="top-right"
        theme="dark"
        offset={{ top: 24, right: 24 }}
        toastOptions={{
          style: {
            background: "rgba(10, 12, 17, 0.95)",
            border: "1px solid var(--aurora-muted)",
            color: "var(--aurora-text)",
            backdropFilter: "blur(12px)",
          },
        }}
      />
      <ToastClickDismiss />
      <KeyboardShortcutsOverlay
        open={isOverlayOpen}
        onOpenChange={(open) => {
          if (!open) closeOverlay()
        }}
      />
    </>
  )
}

export default App
