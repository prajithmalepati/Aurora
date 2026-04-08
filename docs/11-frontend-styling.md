# Aurora — Frontend Styling & Theme
## Document 11 of 12 | For: Qwen (Cline) + Human Review

---

## Design Direction

- **Dark mode only** — no light mode toggle, no light theme
- **Aurora-inspired palette** — deep dark backgrounds, teal and green accents, subtle purple highlights
- **Distinctive but not distracting** — this is a tool you use daily, not a portfolio landing page. Clean, readable, efficient.
- **The user has strong design opinions** — any major visual changes should be discussed first

---

## Color Palette

### CSS Custom Properties (set in `src/index.css`)

These are Aurora-specific colors used directly in components via `var(--aurora-*)`:

```css
:root {
  /* Backgrounds — darkest to lightest */
  --aurora-bg-deep:    #0a0e17;     /* deepest background (app shell) */
  --aurora-bg:         #0f1623;     /* main panels */
  --aurora-bg-surface: #151c2e;     /* cards, sidebar, player bar */
  --aurora-bg-hover:   #1a2340;     /* hover states, selected items */

  /* Aurora accent colors */
  --aurora-teal:       #00C9A7;     /* primary accent — buttons, links, active states */
  --aurora-green:      #00E676;     /* secondary accent — success, positive actions */
  --aurora-purple:     #7B68EE;     /* tertiary — subtle highlights, decorative */
  --aurora-blue:       #4FC3F7;     /* info, links */

  /* Text hierarchy */
  --aurora-text:       #E8ECF1;     /* primary text — titles, body */
  --aurora-text-dim:   #8892A4;     /* secondary text — artist names, counts, labels */
  --aurora-text-muted: #4A5568;     /* disabled, placeholder, timestamps */

  /* Borders */
  --aurora-border:     #1E293B;     /* subtle borders — between rows, panels */
  --aurora-border-bright: #2D3B55;  /* focused borders — input focus states */

  /* Status colors */
  --aurora-danger:     #EF4444;     /* delete, error, destructive actions */
  --aurora-warning:    #F59E0B;     /* warnings, caution */
}
```

### shadcn/ui Theme Override

shadcn/ui uses its own CSS variables for theming. After `npx shadcn@latest init` generates the default variables in `index.css`, override them to match Aurora's palette. The key mappings:

```css
/* Override shadcn's generated theme variables */
/* These go inside the :root or .dark selector that shadcn creates */

--background: 222 47% 7%;         /* #0a0e17 in HSL */
--foreground: 215 25% 92%;        /* #E8ECF1 */
--primary: 167 100% 39%;          /* #00C9A7 */
--primary-foreground: 222 47% 7%; /* dark text on teal buttons */
--secondary: 222 35% 13%;         /* #151c2e */
--secondary-foreground: 215 25% 92%;
--accent: 224 37% 17%;            /* #1a2340 */
--accent-foreground: 215 25% 92%;
--destructive: 0 84% 60%;         /* #EF4444 */
--destructive-foreground: 0 0% 100%;
--border: 217 33% 17%;            /* #1E293B */
--input: 217 33% 17%;
--ring: 167 100% 39%;             /* teal focus ring */
--muted: 222 35% 13%;             /* #151c2e */
--muted-foreground: 218 16% 59%;  /* #8892A4 */
--card: 223 36% 10%;              /* #0f1623 */
--card-foreground: 215 25% 92%;
--popover: 223 36% 10%;
--popover-foreground: 215 25% 92%;
```

**Note:** shadcn uses HSL values without the `hsl()` wrapper (e.g., `222 47% 7%` not `hsl(222, 47%, 7%)`). This is how their CSS variable system works with Tailwind.

---

## Typography

### Fonts

**Display font:** `Outfit` — geometric sans-serif with personality. Used for:
- Aurora logo text in sidebar
- Page/section titles
- Playlist names in headers
- Query builder display text

**Body font:** `Geist` — clean, modern, excellent readability at small sizes. Used for:
- Table text (song titles, artist names)
- Form labels and inputs
- Sidebar items
- All body copy
- Player bar text

### Google Fonts Import

At the top of `src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Geist:wght@400;500;600&display=swap');
```

### Font Application

```css
body {
  font-family: 'Geist', system-ui, sans-serif;
  background-color: var(--aurora-bg-deep);
  color: var(--aurora-text);
}
```

For display text, use Tailwind's arbitrary font class:
```html
<h1 class="font-['Outfit'] text-2xl font-bold text-[var(--aurora-teal)]">Aurora</h1>
```

Or define a custom Tailwind class in the CSS:
```css
.font-display {
  font-family: 'Outfit', sans-serif;
}
```

---

## Common UI Patterns

### Buttons

Use shadcn `<Button>` with variant overrides:

```tsx
// Primary action (teal)
<Button>Search</Button>

// Secondary action
<Button variant="secondary">Clear</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Ghost / icon-only
<Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
```

The shadcn theme variables handle colors automatically once overridden.

### Inputs

shadcn `<Input>` inherits from the theme. Dark background, lighter text, teal focus ring:

```tsx
<Input
  placeholder="Search songs..."
  className="bg-[var(--aurora-bg)] border-[var(--aurora-border)] focus:border-[var(--aurora-teal)]"
/>
```

### Dialogs

All modals use shadcn `<Dialog>`. They inherit the dark theme automatically. Content background will be `var(--card)` which maps to `#0f1623`.

### Tag Chips

Small pills: `bg-[var(--aurora-bg-hover)] text-[var(--aurora-teal)] text-xs px-2 py-0.5 rounded-full`

Removable variant adds a small X button.
Clickable variant adds `cursor-pointer hover:bg-[var(--aurora-bg-hover)]/80`.

### Table Rows

```
bg-[var(--aurora-bg)]
border-b border-[var(--aurora-border)]
hover:bg-[var(--aurora-bg-hover)] transition-colors duration-150
```

Currently-playing row: `border-l-2 border-l-[var(--aurora-teal)]`

### Sidebar Items

```
px-3 py-2 rounded-md cursor-pointer
hover:bg-[var(--aurora-bg-hover)] transition-colors duration-150
```

Active: `bg-[var(--aurora-bg-hover)] border-l-3 border-l-[var(--aurora-teal)]`

### Playlist Color Dots

Small colored circles in the sidebar next to playlist names:

```tsx
<div
  className="w-2 h-2 rounded-full flex-shrink-0"
  style={{ backgroundColor: playlist.color || "var(--aurora-teal)" }}
/>
```

### Scrollbars

Style for webkit browsers to match the dark theme:

```css
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: var(--aurora-bg-deep);
}
::-webkit-scrollbar-thumb {
  background: var(--aurora-border-bright);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--aurora-text-muted);
}
```

---

## Transitions & Animation

Keep it subtle — this is a productivity tool, not a showcase:

- **Hover states:** `transition-colors duration-150` on all interactive elements
- **Dialog open/close:** shadcn handles this with built-in fade/scale animation
- **Toast notifications:** Sonner (shadcn's toast) handles its own enter/exit animations
- **No page transitions** — view switches are instant

Later (polish phase):
- Subtle fade-in on song table rows when data loads
- Progress bar smooth animation
- Sidebar collapse/expand if we ever go responsive

---

## Spacing Guidelines

- **Sidebar padding:** `p-4` (16px all around)
- **Main area padding:** `p-6` (24px)
- **Between sections:** `space-y-4` or `gap-4` (16px)
- **Table cell padding:** `px-4 py-3` (horizontal 16px, vertical 12px)
- **Dialog padding:** shadcn default (fine as-is)
- **Player bar padding:** `px-6 py-3`

---

## Icons

All icons from Lucide React (installed with shadcn/ui). Import individually:

```typescript
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX,
  Search, Filter,
  Plus, Trash2, Pencil, Tag, ListPlus,
  ChevronUp, ChevronDown,
  X, FolderSearch,
} from "lucide-react"
```

Icon sizing: `h-4 w-4` for inline/table icons, `h-5 w-5` for buttons, `h-6 w-6` for player controls.

---

## Toast Notifications

Using Sonner (shadcn's toast system). Add `<Toaster />` once in `App.tsx`:

```tsx
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <>
      <AppShell ... />
      <Toaster position="bottom-right" theme="dark" />
    </>
  )
}
```

Usage in stores/components:
```typescript
import { toast } from "sonner"

toast.success("Song added")
toast.error("Failed to delete song")
toast.info("Scan complete: 42 songs imported")
```

---

## What NOT to Do

- No light mode
- No CSS gradients trying to look like aurora borealis (the user explicitly hated this — save it for the landing page with a real photograph)
- No Inter, Roboto, Arial, or system fonts
- No rounded-everything bubbly aesthetic — keep it angular and purposeful
- No excessive animations or loading spinners
- No purple-on-white color schemes
- No generic "AI slop" design patterns
