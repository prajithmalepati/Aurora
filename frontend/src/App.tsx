import { useEffect, useState } from "react"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { usePlayerStore } from "@/stores/playerStore"
import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { PlayerBar } from "@/components/layout/PlayerBar"
import { Toaster } from "sonner"
import { SongTable } from "@/components/songs/SongTable"
import { PlaylistDetail } from "@/components/playlists/PlaylistDetail"
import { QueryBuilder } from "@/components/filter/QueryBuilder"
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

  const togglePlay = usePlayerStore((state) => state.togglePlay)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      e.preventDefault()
      togglePlay()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [togglePlay])

  const handlePlaySong = (song: Song) => {
    playSong(song, songs)
  }

  const renderMainContent = () => {
    switch (view.kind) {
      case "all-songs":
        return (
          <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto aurora-fade-in">
            {/* Search bar */}
            <div
              className="relative flex items-center rounded-full mb-6 transition-all duration-200 focus-within:shadow-[0_0_20px_-6px_rgba(94,234,212,0.2),0_0_20px_-6px_rgba(167,139,250,0.15)]"
              style={{
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--aurora-rim)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <Search
                className="absolute left-4 h-3.5 w-3.5 text-[var(--aurora-text-muted)] pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Search titles, artists, albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-none pl-11 pr-5 py-2.5 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] placeholder:font-display-italic placeholder:text-[14px]"
              />
            </div>

            <SongTable songs={songs} loading={songsLoading} onPlay={handlePlaySong} />
          </div>
        )
      case "filter":
        return <QueryBuilder />
      case "playlist":
        return <PlaylistDetail playlistId={view.playlistId} />
    }
  }

  return (
    <>
      <AppShell
        children={{
          sidebar: <Sidebar currentView={view} onViewChange={setView} />,
          main: renderMainContent(),
          playerBar: <PlayerBar />,
        }}
      />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(10, 12, 17, 0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--aurora-text)",
            backdropFilter: "blur(12px)",
          },
        }}
      />
    </>
  )
}

export default App
