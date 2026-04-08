import { useEffect, useState } from "react"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { useTagStore } from "@/stores/tagStore"
import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { PlayerBar } from "@/components/layout/PlayerBar"
import { Toaster } from "sonner"

type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }

function App() {
  const [view, setView] = useState<View>({ kind: "all-songs" })

  const fetchSongs = useSongStore((state) => state.fetchSongs)
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists)
  const fetchTags = useTagStore((state) => state.fetchTags)

  useEffect(() => {
    fetchSongs()
    fetchPlaylists()
    fetchTags()
  }, [fetchSongs, fetchPlaylists, fetchTags])

  const renderMainContent = () => {
    switch (view.kind) {
      case "all-songs":
        return <div className="p-4">All Songs View</div>
      case "filter":
        return <div className="p-4">Filter View</div>
      case "playlist":
        return <div className="p-4">Playlist {view.playlistId}</div>
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
