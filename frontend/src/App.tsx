import { useEffect, useState } from "react"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { PlayerBar } from "@/components/layout/PlayerBar"
import { Toaster } from "sonner"
import { SongTable } from "@/components/songs/SongTable"
import { AddSongDialog } from "@/components/songs/AddSongDialog"
import { Input } from "@/components/ui/input"
import { PlaylistDetail } from "@/components/playlists/PlaylistDetail"

function App() {
  const [searchQuery, setSearchQuery] = useState("")

  const fetchSongs = useSongStore((state) => state.fetchSongs)
  const songs = useSongStore((state) => state.songs)
  const view = useSongStore((state) => state.view)
  const setView = useSongStore((state) => state.setView)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)
  const fetchTags = useTagStore((state) => state.fetchTags)

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

  const renderMainContent = () => {
    switch (view.kind) {
      case "all-songs":
        return (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Input
                type="text"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)] flex-1"
              />
              <AddSongDialog />
            </div>
            <SongTable songs={songs} loading={false} />
          </div>
        )
      case "filter":
        return <div className="p-4">Filter View</div>
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
      <Toaster position="bottom-right" theme="dark" />
    </>
  )
}

export default App
