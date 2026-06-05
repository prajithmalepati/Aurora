# Aurora &mdash; A beautiful offline music library for your desktop

<!-- TODO: add screenshots -->

Aurora is a personal music library that lives on your machine. No cloud, no accounts, no ads &mdash; just your music, beautifully organized. Tag songs your way, filter with boolean expressions, and enjoy playback with gapless transitions, reactive visualizations, and smart crossfade.

## Features

- 🎵 **Local-first offline playback** with gapless transitions
- 🎨 **Aurora shader** &mdash; reactive Northern Lights visualization synced to your music
- 🏷️ **Custom tagging** with a boolean filter engine (AND/OR/NOT with parentheses)
- 📋 **Smart playlists** with drag-to-reorder, import/export (M3U/JSON)
- 🎚️ **3-mode crossfade** (Linear, Equal Power, Overlap) with per-playlist settings
- 🔊 **ReplayGain** volume normalization (Track and Album modes)
- ⌨️ **16 keyboard shortcuts** with overlay reference
- 📊 **Queue management** with history, reorder, and Play Next
- 📁 **Folder-level browsing** &mdash; navigate your library by directory structure
- 🌙 **Dark mode** (OLED-optimized)
- 🎤 **Multi-artist tag parsing** with featured artist display
- 📈 **Rich metadata display** &mdash; format badge, bitrate, sample rate, file size
- 🔒 **No ads, no subscriptions, no tracking** &mdash; your music, your library

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19 &middot; Vite 6 &middot; TypeScript 5 &middot; Tailwind 4 &middot; shadcn/ui &middot; Zustand &middot; Howler.js |
| **Backend** | FastAPI &middot; SQLite (WAL) &middot; mutagen |

## Prerequisites

- **Python 3.11** or later
- **Node.js 20** or later
- **pip** (bundled with Python)

## Quick Start

```bash
git clone https://github.com/prajithmalepati/Aurora.git
cd Aurora

# Backend
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py                 # starts on http://localhost:8000

# Frontend (open a new terminal)
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

Open http://localhost:5173 in your browser. The app will connect to the backend automatically on port 8000.

## Usage

### Scanning music
Click **Settings &rarr; Scan** and choose a folder containing audio files. Aurora walks the folder recursively, extracts metadata and album art, computes ReplayGain and dominant colors, and imports everything into your library.

### Filtering with tags
Use the **Mix** view to query your library with boolean expressions like:

```
anime AND (rock OR pop) NOT jazz
```

The filter engine supports parentheses for grouping, so complex queries stay readable.

### Playlists
Create playlists from the sidebar, then drag songs to reorder them. Right-click any track for queue actions like **Play Next** or **Add to Queue**. Export playlists as M3U or JSON for sharing or backup.

### Keyboard shortcuts
Press `?` anywhere in the app to see all 16 shortcuts. Space plays/pauses, arrows navigate tracks, and more.

## Development

### Commit format

We use conventional commits: `type(scope): description`

Examples: `fix(player): resolve crossfade overlap bug`, `feat(tags): add case-insensitive filtering`

### Code style

See [CLAUDE.md](CLAUDE.md) for project conventions, store architecture, and component guidelines.

### Architecture

See [docs/01-data-model.md](docs/01-data-model.md) for the database schema and data flow overview. Additional spec documents live under `docs/`.

### Project structure

```
Aurora/
├── backend/
│   ├── app/
│   │   ├── routers/       # FastAPI route handlers (songs, tags, playlists, filter, scanner)
│   │   ├── services/      # Filter engine, file scanner, color utilities
│   │   ├── models.py      # SQLAlchemy models
│   │   └── main.py        # App entry point
│   └── run.py             # Dev server launcher
├── frontend/
│   ├── src/
│   │   ├── components/    # React components (ui/, layout/, songs/, playlists/, etc.)
│   │   ├── stores/        # Zustand stores (song, filter, player, playlist, tag, settings)
│   │   ├── hooks/         # Custom hooks (useAudioPlayer, useAuroraColor, etc.)
│   │   └── lib/           # API client, toast helpers, utilities
│   └── ...
└── docs/                  # Specifications and design documents
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
