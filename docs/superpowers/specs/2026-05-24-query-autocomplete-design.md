# Query Autocomplete on Mix Input

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Frontend only (QueryInput + new AutocompleteDropdown component)

---

## Overview

As the user types in the Mix/filter query input, a dropdown appears below showing matching tags and operators. Operators (AND/OR/NOT) are prioritized and styled distinctly. Accepting a suggestion replaces the current in-progress token in the query string. Keyboard-first but also mouse-friendly.

---

## Backend

No changes. Tags fully loaded in `tagStore` on init via `GET /tags`. Playlists in `playlistStore`. Client-side filtering is sufficient for personal library tag counts.

---

## Frontend

### Token Detection

On every keystroke, a position-aware tokenizer finds the token at the cursor:

```ts
function getTokenAtCursor(query: string, cursorPos: number): {
  token: string
  start: number
  end: number
  context: "tag" | "operator" | "quoted" | "none"
}
```

**Context rules:**
- After AND/OR/NOT or `(` or at query start → `"tag"` (suggest tags + operators)
- After a tag name or `)` → `"operator"` (suggest AND/OR/NOT only)
- Inside a quoted string `"..."` → `"quoted"` (no suggestions)
- Empty token at any position → `"none"` (no dropdown)

### Match Ranking

Three tiers, computed in order, capped at 8 total items:

1. **Operators** — AND, OR, NOT — shown first if token prefix matches (case-insensitive). Always rendered as badge-style chips.
2. **Tags: startsWith** — `tag.name.toLowerCase().startsWith(token.toLowerCase())` — full brightness.
3. **Tags: substring** — `tag.name.toLowerCase().includes(token.toLowerCase())` and not already in tier 2 — dimmer (`--aurora-text-secondary`).

### Types

```ts
type SuggestionItem =
  | { kind: "operator"; value: "AND" | "OR" | "NOT" }
  | { kind: "tag"; name: string; matchType: "prefix" | "substring" }
```

### `AutocompleteDropdown` Component

New file: `src/components/filter/AutocompleteDropdown.tsx`

Rendered inside `QueryInput`, positioned absolute below the input. Only mounts when `showDropdown && suggestions.length > 0`.

**Layout:**
```
┌─────────────────────────────────┐
│ anime AND slo                   │  ← QueryInput
└─────────────────────────────────┘
  ┌───────────────────────────────┐
  │ [AND]  [OR]                   │  ← operator badges (label-micro pill)
  │  slow                         │  ← prefix match, full brightness
  │  slow burn                    │
  │  also slow                    │  ← substring match, --aurora-text-secondary
  └───────────────────────────────┘
```

**Styling:**
- Glassmorphism surface + `aurora-rim` border — matches existing popovers/dialogs
- `aurora-fade-in` entrance animation
- Active item: `--aurora-accent-interactive` left bar (3px), same pattern as active song in PlaylistDetail
- Operator badges: `label-micro` pill with `--aurora-surface-3` background, distinct from tag rows
- Z-index above song table

**Keyboard behavior:**

| Key | Action |
|-----|--------|
| `ArrowDown` | Move selection down (wraps to top) |
| `ArrowUp` | Move selection up (wraps to bottom) |
| `Tab` | Accept selected item (or top item if none selected) |
| `Enter` | Accept selected item if dropdown open + item highlighted; otherwise execute filter as normal |
| `Esc` | Dismiss dropdown, return focus to input |
| Any other key | Continue typing, update suggestions live, reset selection to -1 |

**Acceptance behavior:**
1. Splice current token out of query string: `query.slice(0, tokenStart) + accepted + " " + query.slice(tokenEnd)`
2. For tags with spaces in name: wrap in double quotes → `"slow burn"`
3. Move cursor to end of inserted value
4. Close dropdown
5. Do NOT call `executeFilter()` — user continues editing query

### `QueryInput` Changes

New state:
```ts
const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
const [selectedIndex, setSelectedIndex] = useState(-1)
const [showDropdown, setShowDropdown] = useState(false)
```

**`onChange` flow:**
1. Call existing `setQuery(value)` (unchanged)
2. Run `getTokenAtCursor(value, e.target.selectionStart)`
3. If context is `"quoted"` or `"none"` → `setShowDropdown(false)`
4. Otherwise compute suggestions from tagStore + operators
5. `setSuggestions(results)`, `setShowDropdown(results.length > 0)`, `setSelectedIndex(-1)`

**`onBlur`:** 150ms delay before hiding dropdown — allows mouse click on a suggestion to register first.

**`onKeyDown` additions** (intercept before existing handler):
- If dropdown open: handle Arrow/Tab/Enter/Esc as above, `preventDefault()` on those keys
- If dropdown closed: existing behavior unchanged

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Empty input | No dropdown |
| Typing inside quoted string | No suggestions |
| Token matches nothing | Dropdown hidden |
| Tag name contains spaces | Accepted value wrapped in `"..."` |
| AND/OR/NOT fully typed + space | Token becomes empty, dropdown hides |
| Blur (click outside) | 150ms delay allows item click to land first |
| Query ends with operator | Only tag suggestions (not another operator after an operator) |
| All tags filtered out, operators match | Show operators only |
| Enter with no item selected | Execute filter as normal (existing behavior) |
| Cursor moved mid-query (click to reposition) | `onSelect` / `onClick` on input re-runs tokenizer at new cursor position |

---

## Out of Scope

- Playlist name suggestions in autocomplete (tags only + operators)
- Fuzzy character-by-character matching (prefix + substring covers the use case)
- Autocomplete in the playlist search bar (different input, simpler use case)
