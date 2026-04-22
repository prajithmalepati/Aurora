export interface Song {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  source: string
  external_id?: string | null
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
}

export interface Playlist {
  id: number
  name: string
  color: string | null
  emoji: string | null
  image_url: string | null
  song_count: number
  created_at: string
  updated_at: string
}

export interface PlaylistDetail extends Playlist {
  songs: PlaylistSong[]
}

export interface PlaylistSong {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  tags: string[]
  position: number
}

export interface Tag {
  id: number
  name: string
  song_count: number
  created_at: string
}

export interface FilterResult {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  source: string
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
}

export interface ScanResult {
  scanned: number
  imported: number
  skipped: number
  errors: { file: string; error: string }[]
  songs: Song[]
}

export interface ApiResponse<T> {
  data: T
  message: string
  total?: number
  query?: string
}