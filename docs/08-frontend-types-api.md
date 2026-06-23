# Aurora — Frontend Types & API Client
## Document 8 of 12

---

## TypeScript Types

All types live in `src/types/index.ts`. These mirror the backend API responses exactly. Every component and store imports from here.

```typescript
// ============================================================
// SONGS
// ============================================================

// Matches items in GET /api/songs and GET /api/songs/{id}
export interface Song {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null       // seconds, null if unknown
  file_path: string | null      // absolute path to local file, null for manual songs
  source: string                // "manual" | "local_scan"
  external_id?: string | null   // unused in v1, reserved for Spotify/YouTube
  tags: string[]                // tag name strings
  playlists: string[]           // playlist name strings
  created_at: string            // ISO 8601
  updated_at: string            // ISO 8601
}

// ============================================================
// PLAYLISTS
// ============================================================

// Matches items in GET /api/playlists
export interface Playlist {
  id: number
  name: string
  color: string | null          // hex color like "#E63946"
  emoji: string | null          // single emoji character
  song_count: number
  created_at: string
  updated_at: string
}

// Matches GET /api/playlists/{id} — playlist with its songs
export interface PlaylistDetail extends Playlist {
  songs: PlaylistSong[]
}

// Songs inside a playlist detail response have position, not playlists[]
export interface PlaylistSong {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  tags: string[]
  position: number
}

// ============================================================
// TAGS
// ============================================================

// Matches items in GET /api/tags
export interface Tag {
  id: number
  name: string
  song_count: number
  created_at: string
}

// ============================================================
// FILTER
// ============================================================

// Matches items in POST /api/filter response
export interface FilterResult {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  tags: string[]
  playlists: string[]
  source: string
}

// ============================================================
// SCANNER
// ============================================================

// Matches POST /api/scan response.data
export interface ScanResult {
  scanned: number
  imported: number
  skipped: number
  errors: { file: string; error: string }[]
  songs: Song[]
}

// ============================================================
// API ENVELOPE
// ============================================================

// Standard wrapper for all API responses
export interface ApiResponse<T> {
  data: T
  message: string
  total?: number
  query?: string              // only on filter responses
}
```

---

## API Client

Lives in `src/lib/api.ts`. Every component and store uses this — never raw `fetch()`.

```typescript
const BASE_URL = "http://localhost:8000/api"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new ApiError(err.detail || res.statusText, res.status)
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
}
```

### Why this exists

Without it, you end up with `fetch("http://localhost:8000/api/songs")` and inline error handling in every single component. This centralizes:
- Base URL (change once if the port changes)
- Headers (Content-Type always set)
- Error parsing (API returns `{ detail: "..." }` for errors)
- Type inference (`api.get<ApiResponse<Song[]>>("/songs")` gives you typed data)

### Usage examples

```typescript
import { api } from "@/lib/api"
import type { Song, Playlist, ApiResponse } from "@/types"

// Fetch all songs
const res = await api.get<ApiResponse<Song[]>>("/songs")
// res.data = Song[], res.total = number

// Fetch songs with search
const res = await api.get<ApiResponse<Song[]>>("/songs?search=highway")

// Create a song
await api.post<ApiResponse<Song>>("/songs", {
  title: "Highway Star",
  artist: "Deep Purple",
})

// Update a song
await api.put<ApiResponse<Song>>("/songs/1", { album: "Machine Head" })

// Delete a song
await api.delete<{ message: string }>("/songs/1")

// Filter
const res = await api.post<ApiResponse<FilterResult[]>>("/filter", {
  query: "slow AND rock",
})

// Scan a folder
const res = await api.post<ApiResponse<ScanResult>>("/scan", {
  folder_path: "C:\\Users\\rockz\\Music\\Rock",
  playlist_name: "Rock",
})
```

### Audio stream URL

The audio player does NOT use the api client for streaming. It constructs URLs directly:

```typescript
const streamUrl = `http://localhost:8000/api/songs/${songId}/stream`
// This URL is passed to Howler.js as the audio source
```

This is because Howler.js needs a URL string, not a fetch call.
