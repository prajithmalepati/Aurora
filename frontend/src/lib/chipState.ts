/**
 * Three-state chip state logic for QueryBuilder.
 *
 * Pure functions — no Zustand, no React. Testable in isolation.
 *
 * Architecture:
 *   parseChipStates(query, knownAtoms) → { states, isCustom }
 *   canonicalizeQuery(includes, excludes) → query string
 *   toggleAtom(query, atom, knownAtoms, shiftHeld?) → new query
 *
 * Brief: G3/E1 — Three-state tag chips
 */

export type ChipState = "neutral" | "included" | "excluded"

export interface ParsedChips {
  /** Per-atom chip state, keyed by atom name (same names as input `knownAtoms`). */
  states: Map<string, ChipState>
  /** True when the query contains OR, parens, or unknown terms — chips go neutral. */
  isCustom: boolean
}

// ── Tokeniser ────────────────────────────────────────────────────────────────

type Token =
  | { kind: "atom"; value: string }   // bare or quoted atom
  | { kind: "AND" }
  | { kind: "OR" }
  | { kind: "NOT" }
  | { kind: "LPAREN" }
  | { kind: "RPAREN" }

/**
 * Tokenise a query string into a flat token list.
 * Quoted strings are recognised as a single atom token.
 * Bare words are matched case-insensitively against known atoms first,
 * then against the operator vocabulary AND/OR/NOT.
 */
function tokenise(query: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = query.length

  while (i < len) {
    // skip whitespace
    if (/\s/.test(query[i])) { i++; continue }

    // quoted string → atom
    if (query[i] === '"') {
      const end = query.indexOf('"', i + 1)
      if (end === -1) {
        // unmatched quote — treat rest as atom
        tokens.push({ kind: "atom", value: query.slice(i + 1) })
        break
      }
      tokens.push({ kind: "atom", value: query.slice(i + 1, end) })
      i = end + 1
      continue
    }

    // parens (single-char tokens)
    if (query[i] === '(') { tokens.push({ kind: "LPAREN" }); i++; continue }
    if (query[i] === ')') { tokens.push({ kind: "RPAREN" }); i++; continue }

    // bare word
    let j = i
    while (j < len && !/\s/.test(query[j]) && query[j] !== '"' && query[j] !== '(' && query[j] !== ')') {
      j++
    }
    const word = query.slice(i, j)

    // Check operators — only bare uppercase words that are NOT substrings of atom names
    if (word === "AND") { tokens.push({ kind: "AND" }); i = j; continue }
    if (word === "OR")  { tokens.push({ kind: "OR" });  i = j; continue }
    if (word === "NOT") { tokens.push({ kind: "NOT" }); i = j; continue }

    // Otherwise it's an atom (bare word)
    tokens.push({ kind: "atom", value: word })
    i = j
  }

  return tokens
}

// ── Parser ───────────────────────────────────────────────────────────────────

interface ParsedQuery {
  /** Includes in order of appearance. */
  includes: string[]
  /** Excludes in order of appearance. */
  excludes: string[]
  /** True if the query is NOT a pure conjunction of known atoms. */
  isCustom: boolean
}

/**
 * Parse a query into includes/excludes.
 * A "canonical" query is a conjunction (AND-only) of known atoms,
 * where some are prefixed with NOT.
 *
 * Returns isCustom=true if:
 *   - OR or parens are present
 *   - any atom is not in knownAtoms
 */
function parseQuery(query: string, knownAtoms: string[]): ParsedQuery {
  if (!query.trim()) {
    return { includes: [], excludes: [], isCustom: false }
  }

  const tokens = tokenise(query)
  const normalised = knownAtoms.map((a) => a.toLowerCase())

  const includes: string[] = []
  const excludes: string[] = []
  let isCustom = false
  let expectNot = false

  for (const token of tokens) {
    switch (token.kind) {
      case "OR":
      case "LPAREN":
      case "RPAREN":
        isCustom = true
        break
      case "NOT":
        expectNot = true
        break
      case "AND":
        // AND is the expected separator — just consume
        break
      case "atom": {
        const idx = normalised.indexOf(token.value.toLowerCase())
        if (idx === -1) {
          // Unknown atom — custom mode
          isCustom = true
        } else {
          const atomName = knownAtoms[idx]
          if (expectNot) {
            excludes.push(atomName)
          } else {
            includes.push(atomName)
          }
        }
        expectNot = false
        break
      }
    }
  }

  return { includes, excludes, isCustom }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine chip states from a query string.
 *
 * - If the query is a pure conjunction of known atoms → chips show include/exclude state.
 * - If OR, parens, or unknown terms are present → custom mode, all chips neutral.
 */
export function parseChipStates(query: string, knownAtoms: string[]): ParsedChips {
  const { includes, excludes, isCustom } = parseQuery(query, knownAtoms)

  const states = new Map<string, ChipState>()
  for (const atom of knownAtoms) {
    states.set(atom, "neutral")
  }

  if (!isCustom) {
    for (const atom of includes) {
      states.set(atom, "included")
    }
    for (const atom of excludes) {
      states.set(atom, "excluded")
    }
  }

  return { states, isCustom }
}

/**
 * Build a canonical query string from includes and excludes.
 *
 * Rules:
 *   - Includes come first, joined with AND
 *   - Then excludes, each prefixed with NOT, joined with AND
 *   - Multi-word atoms are quoted
 *   - Single-word atoms are bare
 */
export function canonicalizeQuery(includes: string[], excludes: string[]): string {
  const parts: string[] = []

  for (const atom of includes) {
    parts.push(quoteIfNeeded(atom))
  }
  for (const atom of excludes) {
    parts.push(`NOT ${quoteIfNeeded(atom)}`)
  }

  return parts.join(" AND ")
}

/**
 * Toggle an atom's state in the query.
 *
 * Cycle: neutral → included → excluded → neutral
 * Shift-click: goes directly to excluded (or removes if already excluded).
 *
 * If the current query is in custom mode (OR/parens/unknown terms),
 * falls back to appendTerm behavior — appends the atom with AND.
 */
export function toggleAtom(
  currentQuery: string,
  atom: string,
  knownAtoms: string[],
  shiftHeld: boolean = false,
): string {
  const { includes, excludes, isCustom } = parseQuery(currentQuery, knownAtoms)

  if (isCustom) {
    // Custom mode — append term, but strip trailing operators first
    let trimmed = currentQuery.trim()
    // Strip trailing operators (AND, OR, NOT) to prevent "X OR AND Y" malformation
    trimmed = trimmed.replace(/\s+(AND|OR|NOT)\s*$/i, "").trim()
    // Also handle bare trailing operator (e.g., just "OR")
    if (/^(AND|OR|NOT)$/i.test(trimmed)) {
      trimmed = ""
    }
    if (!trimmed) return quoteIfNeeded(atom)
    return `${trimmed} AND ${quoteIfNeeded(atom)}`
  }

  const incIdx = includes.indexOf(atom)
  const excIdx = excludes.indexOf(atom)

  if (incIdx !== -1) {
    // Currently included
    if (shiftHeld) {
      // Move to excluded
      includes.splice(incIdx, 1)
      excludes.push(atom)
    } else {
      // Cycle: included → excluded
      includes.splice(incIdx, 1)
      excludes.push(atom)
    }
  } else if (excIdx !== -1) {
    // Currently excluded → remove (neutral)
    excludes.splice(excIdx, 1)
  } else {
    // Currently neutral
    if (shiftHeld) {
      excludes.push(atom)
    } else {
      includes.push(atom)
    }
  }

  return canonicalizeQuery(includes, excludes)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function quoteIfNeeded(atom: string): string {
  if (atom.includes(" ") || atom.includes('"')) {
    return `"${atom.replace(/"/g, '\\"')}"`
  }
  return atom
}
