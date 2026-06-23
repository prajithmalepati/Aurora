# Aurora — Frontend Project Structure & Setup
## Document 7 of 12

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 19.x | UI framework |
| Vite | 6.x | Build tool + dev server (port 5173) |
| TypeScript | 5.x | Type safety — catches API shape mismatches at compile time |
| Tailwind CSS | 4.x | Utility-first styling via `@tailwindcss/vite` plugin |
| shadcn/ui | latest | Pre-built accessible components (Button, Dialog, Input, Table, etc.) |
| Zustand | 5.x | Global state management |
| Howler.js | 2.x | Audio playback (Web Audio API with HTML5 fallback) |
| Lucide React | latest | Icons (ships with shadcn/ui) |

---

## Why These Choices

**TypeScript over JavaScript:** Aurora has interconnected state (songs reference tags and playlists). TS catches mismatched shapes between API responses and frontend models at build time. The extra setup is 2 minutes; the bug prevention is permanent.

**Zustand over Context:** Aurora has 5 distinct state domains (songs, playlists, tags, filter results, player). React Context would require 5 providers and manual re-render optimization. Zustand is ~3KB, needs zero providers, and uses selectors for granular re-renders. Most popular React state library in 2026 (~20M weekly npm downloads).

**Howler.js over raw HTML5 Audio:** Abstracts Web Audio API vs HTML5 Audio differences, handles codec detection, provides seek/volume/fade APIs. 7KB gzipped. Use in `html5: true` mode for streaming large local files without waiting for full download.

**shadcn/ui over building from scratch:** Copy-paste component library built on Radix primitives. Fully accessible, fully customizable, works with Tailwind. We override the default theme with Aurora's dark palette. Saves weeks of building dialogs, dropdowns, tables, and inputs.

---

## Folder Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── components.json                 # shadcn/ui config
├── src/
│   ├── main.tsx                    # React root mount
│   ├── App.tsx                     # Layout shell: Sidebar + Main + PlayerBar
│   ├── index.css                   # Tailwind import + Aurora theme overrides
│   ├── lib/
│   │   ├── utils.ts                # shadcn cn() utility
│   │   └── api.ts                  # API client (fetch wrapper)
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces matching API responses
│   ├── stores/
│   │   ├── songStore.ts            # Songs state + CRUD actions
│   │   ├── playlistStore.ts        # Playlists state + CRUD actions
│   │   ├── tagStore.ts             # Tags state + actions
│   │   ├── filterStore.ts          # Filter query + results
│   │   └── playerStore.ts          # Current track, play/pause, seek, queue
│   ├── components/
│   │   ├── ui/                     # shadcn/ui generated components (don't edit)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # Playlists nav, Filter View button
│   │   │   ├── PlayerBar.tsx       # Bottom audio player
│   │   │   └── AppShell.tsx        # Grid layout wrapper
│   │   ├── songs/
│   │   │   ├── SongTable.tsx       # Main results table
│   │   │   ├── SongRow.tsx         # Single row in table
│   │   │   ├── AddSongDialog.tsx   # Modal form: add song manually
│   │   │   └── EditSongDialog.tsx  # Modal form: edit song
│   │   ├── tags/
│   │   │   ├── TagEditor.tsx       # Modal: manage tags on a song
│   │   │   ├── TagChip.tsx         # Single tag badge (clickable)
│   │   │   └── TagList.tsx         # Row of tag chips
│   │   ├── playlists/
│   │   │   ├── PlaylistItem.tsx    # Single sidebar playlist entry
│   │   │   ├── CreatePlaylistDialog.tsx
│   │   │   └── PlaylistDetail.tsx  # Playlist view with its songs
│   │   ├── filter/
│   │   │   ├── QueryBuilder.tsx    # Operator buttons + tag chips + text input
│   │   │   └── QueryInput.tsx      # Raw text input for typing queries
│   │   └── scanner/
│   │       └── ScanDialog.tsx      # Folder path input + scan button + results
│   └── hooks/
│       └── useAudioPlayer.ts       # Howler.js wrapper hook
```

---

## Setup Commands

### Scaffold the project
```bash
# From aurora/ root (not inside backend/)
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Install Tailwind CSS v4
```bash
npm install -D @tailwindcss/vite @types/node
```

### vite.config.ts (complete)
```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### tsconfig.json (add path alias)
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### tsconfig.app.json (add same alias under compilerOptions)
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

### Initial src/index.css
```css
@import "tailwindcss";
```

Delete `src/App.css` — unused.

### Initialize shadcn/ui
```bash
npx shadcn@latest init
# Base color: Neutral (we override with Aurora colors)
# If React 19 peer dep issue: use --force
```

### Install all needed shadcn components at once
```bash
npx shadcn@latest add button dialog input table alert alert-dialog sonner skeleton slider dropdown-menu popover command
```

### Install remaining dependencies
```bash
npm install zustand howler
npm install -D @types/howler
```

### Running the frontend
```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## Implementation Rules for Frontend Tasks

Rules for the frontend implementation:

```
You are building Aurora's frontend: a React + TypeScript app with Vite, Tailwind CSS v4, shadcn/ui, and Zustand.
- Only implement what is explicitly asked. Do not add extra features, pages, or components.
- All imports use the @/ alias: e.g. import { api } from "@/lib/api"
- State management uses Zustand stores in src/stores/. Never use React Context for app state.
- UI components come from shadcn/ui (src/components/ui/). Do not install other component libraries.
- All API calls go through src/lib/api.ts. Never use raw fetch() in components.
- This is a dark-mode-only app. Never add light mode styles or toggles.
- Keep components small and focused. One component per file.
- Use Tailwind classes for styling. No CSS modules, no styled-components, no inline style objects.
- When importing from shadcn components, use @/components/ui/... paths.
```

---

## Backend CORS (already configured)

The FastAPI backend already allows CORS from `http://localhost:5173` (Vite's default port). No changes needed unless the port changes.
