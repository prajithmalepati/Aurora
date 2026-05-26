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
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
}

export interface Playlist {
  id: number
  name: string
  color: string | null
  emoji: string | null
  image_url: string | null
  crossfade_enabled: number | null
  crossfade_duration_s: number | null
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
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  position: number
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
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
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
}

export interface ScanResult {
  scanned: number
  imported: number
  replaced: number
  skipped: number
  skipped_exact: number
  skipped_same_format: number
  skipped_lower_quality: number
  errors: { file: string; error: string }[]
  songs: Song[]
  replaced_songs: { id: number; replaced_path: string; title: string; artist: string }[]
  art_extracted: number
}

export interface ApiResponse<T> {
  data: T
  message: string
  total?: number
  query?: string
}