import { useEffect, useState, useCallback, type ReactNode } from "react"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlayerStore } from "@/stores/playerStore"
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
import { AnimatePresence, motion } from "motion/react"
import { AuroraColorBridge } from '@/components/aurora/AuroraColorBridge'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useAuroraIntensity } from '@/hooks/useAuroraIntensity'
import { Search } from "lucide-react"
import type { Song } from "@/types"

function App() {
  const [searchQuery, setSearchQuery] = useState("")

  const fetchSongs = useSongStore((state) => state.fetchSongs)
  const songs = useSongStore((state) => state.songs)
  const songsLoading = useSongStore((state) => state.loading)
  const view = useSongStore((state) => state.view)
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)
  const fetchTags = useTagStore((state) => state.fetchTags)
  const playSong = usePlayerStore((state) => state.playSong)

  const amplitude = useAudioAnalyser()
  const intensity = useAuroraIntensity()

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
  const togglePlay = usePlayerStore((state) => state.togglePlay)
  const next = usePlayerStore((state) => state.next)
  const previous = usePlayerStore((state) => state.previous)
  const toggleMute = usePlayerStore((state) => state.toggleMute)

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

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName
    const isTyping = tag === "INPUT" || tag === "TEXTAREA"

    // Escape — blur any focused input
    if (e.key === "Escape") {
      ;(document.activeElement as HTMLElement)?.blur()
      return
    }

    // All remaining shortcuts only fire when NOT typing
    if (isTyping) return

    switch (e.code) {
      case "Space":
        e.preventDefault()
        togglePlay()
        break
      case "ArrowRight":
        e.preventDefault()
        next()
        break
      case "ArrowLeft":
        e.preventDefault()
        previous()
        break
      case "KeyM":
        toggleMute()
        break
      case "Slash":
        e.preventDefault()
        if (view.kind !== "filter") {
          setView({ kind: "filter" })
        }
        // Focus the Mix query input on next tick
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('.mix-query-bar input[type="text"]')
          input?.focus()
        }, 50)
        break
    }
  }, [togglePlay, next, previous, toggleMute, view.kind, setView])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handlePlaySong = (song: Song) => {
    playSong(song, songs)
  }

  const renderMainContent = () => {
    let content: ReactNode
    if (view.kind === "all-songs") {
      content = (
        <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-[28px] leading-none tracking-tight text-[var(--aurora-text)]">
              All Songs
            </h1>
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
          <SongTable songs={songs} loading={songsLoading} onPlay={handlePlaySong} />
        </div>
      )
    } else if (view.kind === "filter") {
      content = <QueryBuilder />
    } else if (view.kind === "playlist") {
      content = <PlaylistDetail key={view.playlistId} playlistId={view.playlistId} />
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
      <AppShell
        amplitude={amplitude}
        intensity={intensity}
        children={{
          sidebar: <Sidebar currentView={view} onViewChange={setView} />,
          main: <ErrorBoundary>{renderMainContent()}</ErrorBoundary>,
          playerBar: <PlayerBar />,
        }}
      />
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
    </>
  )
}

export default App
