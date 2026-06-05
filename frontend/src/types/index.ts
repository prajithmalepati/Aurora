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
  artists?: string[] | null
  featured_artists?: string[] | null
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
  bitrate?: number | null
  sample_rate?: number | null
  bit_depth?: number | null
  file_size?: number | null
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
  replaygain_track_gain?: number | null
  replaygain_track_peak?: number | null
  replaygain_album_gain?: number | null
  replaygain_album_peak?: number | null
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
  artists?: string[] | null
  featured_artists?: string[] | null
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  position: number
  bitrate?: number | null
  sample_rate?: number | null
  bit_depth?: number | null
  file_size?: number | null
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
  replaygain_track_gain?: number | null
  replaygain_track_peak?: number | null
  replaygain_album_gain?: number | null
  replaygain_album_peak?: number | null
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
  artists?: string[] | null
  featured_artists?: string[] | null
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
  bitrate?: number | null
  sample_rate?: number | null
  bit_depth?: number | null
  file_size?: number | null
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
  replaygain_track_gain?: number | null
  replaygain_track_peak?: number | null
  replaygain_album_gain?: number | null
  replaygain_album_peak?: number | null
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

export interface FolderNode {
  name: string
  path: string
  song_count: number
  subfolders?: FolderNode[]
}

export interface FolderTreeResponse {
  folders: FolderNode[]
  total_folders: number
  total_songs: number
}

export interface FolderSongsResponse {
  data: Song[]
  total: number
  path: string
  recursive: boolean
  message: string
}

export interface ApiResponse<T> {
  data: T
  message: string
  total?: number
  query?: string
}