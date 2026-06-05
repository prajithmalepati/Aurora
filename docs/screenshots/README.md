# Aurora Screenshots

Screenshots for the GitHub README, captured automatically via Playwright.

## Regenerating screenshots

1. Start the backend:
   ```bash
   cd backend && source venv/bin/activate && python run.py
   ```

2. Start the frontend dev server:
   ```bash
   cd frontend && npm run dev
   ```

3. Run the capture script:
   ```bash
   cd frontend && node capture-screenshots.mjs
   ```

Screenshots are saved to this directory (`docs/screenshots/`).

## Screenshot list

| # | File | Description |
|---|------|-------------|
| 1 | `01-all-songs.png` | Main All Songs view with song table + player bar |
| 2 | `02-mix-filter.png` | Mix/Filter view with a query and results |
| 3 | `03-folders.png` | Folders tree browser |
| 4 | `04-playlist-detail.png` | Playlist detail with hero header and songs |
| 5 | `05-queue-panel.png` | Slide-out queue panel |
| 6 | `06-settings.png` | Settings panel |
| 7 | `07-keyboard-shortcuts.png` | Keyboard shortcuts overlay (triggered by `?`) |
| 8 | `08-welcome.png` | Welcome / first-run screen |

## Requirements

- Playwright installed (`npm install --save-dev playwright` in `frontend/`)
- Chromium browser (`npx playwright install chromium`)
- Backend and frontend running locally
