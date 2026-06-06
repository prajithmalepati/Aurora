# Aurora

A personal music library with smart tagging, boolean filtering, and a built-in audio player.

![All Songs view](screenshots/all-songs.png)

## Features

- **Smart Boolean Filtering** — query your library with AND, OR, NOT, and parentheses (e.g. `tag:electronic AND bpm:>120 NOT artist:drake`)
- **Custom Tagging** — create and assign tags to any song, filter by combinations
- **Playlist Management** — create playlists, drag-to-reorder songs, per-song trim points
- **Album View** — browse your library by album with cover art grid
- **Waveform Trim Editor** — visual waveform display with draggable start/end handles for per-song trim points
- **Crossfade** — configurable crossfade between tracks with linear, equal-power, and overlap curves
- **Gapless Playback** — preloading for seamless track transitions
- **ReplayGain Normalization** — track and album gain modes to keep volume consistent
- **Multi-Select** — select multiple songs for bulk tagging, adding to playlists, or queue operations
- **Auto-Watch** — register folders to automatically detect and import new music files
- **Playlist Export/Import** — export playlists as `.m3u` / `.m3u8`, import from file
- **Folder Browser** — tree-view navigation of your music directory structure
- **Dark Mode UI** — single dark theme with bleed-glow player bar

## Tech Stack

**Backend**
- Python 3.11+
- FastAPI + Uvicorn
- SQLite (WAL mode)
- Mutagen (audio metadata), Miniaudio (waveform peaks), Pillow (album art)

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS 4 + shadcn/ui
- Zustand (state management)
- Howler.js (audio playback)
- Motion (animations)
- Lucide (icons)

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm (or pnpm)

## Quick Start

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

In a second terminal:

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

The backend API runs on **http://localhost:8000** with Swagger docs at **http://localhost:8000/docs**.

## Configuration

**Environment**

The backend uses a local SQLite database (`aurora.db`) created automatically on first run. No external database setup required.

**Scanning Music**

1. Click the scan button in the sidebar or press `S` to open Settings
2. Enter the path to your music folder
3. Optionally enable "Auto-watch this folder" to detect new files automatically
4. Run the scan

**Audio Settings** (accessible in the UI settings panel)

- Crossfade: enable/disable, duration (1–12 seconds), curve type
- ReplayGain: off, track gain, or album gain mode

All settings persist in localStorage.

## Development

```bash
# Backend tests
cd backend
source venv/bin/activate
python -m pytest tests/ -v

# Frontend build (includes type-check)
cd frontend
npm run build

# Frontend type-check only
cd frontend
npx tsc --noEmit

# Frontend lint
cd frontend
npm run lint
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `→` (ArrowRight) | Next track |
| `←` (ArrowLeft) | Previous track |
| `N` | Next track |
| `P` | Previous track |
| `M` | Mute / Unmute |
| `L` | Toggle shuffle |
| `R` | Cycle repeat mode (off → all → one) |
| `S` | Toggle settings panel |
| `[` | Decrease volume 5% |
| `]` | Increase volume 5% |
| `/` | Focus filter search input |
| `1`–`9` | Switch to playlist 1–9 |
| `?` | Show keyboard shortcuts overlay |
| `Esc` | Close dialog / command palette, blur input |
| `Ctrl+F` / `⌘F` | Focus filter search input |
| `Ctrl+K` / `⌘K` | Open command palette |
| `Ctrl+Shift+F` / `⌘⇧F` | Toggle fullscreen |

All shortcuts are disabled while typing in an input field (except `Esc`).

## Project Structure

```
Aurora/
├── backend/
│   ├── app/
│   │   ├── routers/       # FastAPI routes (songs, tags, playlists, filter, scanner, folders, watcher)
│   │   ├── services/      # Filter engine, file scanner, file watcher
│   │   ├── models.py      # Pydantic models
│   │   ├── database.py    # SQLite schema + migrations
│   │   └── main.py        # FastAPI app
│   ├── tests/
│   └── run.py             # Entry point
├── frontend/
│   └── src/
│       ├── components/    # React components (player, playlists, settings, etc.)
│       ├── stores/        # Zustand stores (song, player, playlist, filter, tag, settings)
│       ├── hooks/         # Audio player, keyboard shortcuts, waveform
│       ├── lib/           # API client, utilities
│       └── types/         # TypeScript types
└── docs/                  # Design specs and implementation plans
```

## License

MIT
