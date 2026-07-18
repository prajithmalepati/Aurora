/**
 * Three-state chip state logic for QueryBuilder.
 *
 * Pure functions — no Zustand, no React. Testable in isolation.
 *
 * Architecture:
 *   parseChipStates(query, knownAtoms) → { states, isCustom }
 *   canonicalizeQuery(includes, excludes) → query string
 *   toggleAtom(query, atom, knownAtoms, shiftHeld?) → new query
 *   isAtomRepresentable(atom) → boolean
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

// ── Engine-safe identifier check ─────────────────────────────────────────

/**
 * The Rust filter engine's bare identifier grammar:
 *   [A-Za-z_][A-Za-z0-9_:]*
 *
 * Operator words (AND, OR, NOT) are reserved case-insensitively.
 */
const BARE_SAFE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const OPERATOR_WORDS = new Set(["and", "or", "not"])

function isBareSafe(atom: string): boolean {
  if (!BARE_SAFE_RE.test(atom)) return false
  if (OPERATOR_WORDS.has(atom.toLowerCase())) return false
  return true
}

/**
 * Check if an atom can be represented in the filter grammar.
 * Atoms containing BOTH double and single quotes are unrepresentable.
 */
export function isAtomRepresentable(atom: string): boolean {
  return !(atom.includes('"') && atom.includes("'"))
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
 * Quoted strings (both double and single) are recognised as a single atom token.
 * Bare words are matched case-insensitively against the operator vocabulary AND/OR/NOT.
 *
 * Note: the Rust engine lowercases quoted atoms; we preserve original case
 * for display but match case-insensitively against known atoms.
 */
function tokenise(query: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = query.length

  while (i < len) {
    // skip whitespace
    if (/\s/.test(query[i])) { i++; continue }

    // quoted string → atom (double or single quotes)
    if (query[i] === '"' || query[i] === "'") {
      const quote = query[i]
      const end = query.indexOf(quote, i + 1)
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
    while (j < len && !/\s/.test(query[j]) && query[j] !== '"' && query[j] !== "'" && query[j] !== '(' && query[j] !== ')') {
      j++
    }
    const word = query.slice(i, j)

    // Check operators — case-insensitive (matching Rust engine behavior)
    const upper = word.toUpperCase()
    if (upper === "AND") { tokens.push({ kind: "AND" }); i = j; continue }
    if (upper === "OR")  { tokens.push({ kind: "OR" });  i = j; continue }
    if (upper === "NOT") { tokens.push({ kind: "NOT" }); i = j; continue }

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
 *   - Atoms are quoted per engine grammar (see quoteIfNeeded)
 *   - Unrepresentable atoms (containing both quote chars) are skipped
 */
export function canonicalizeQuery(includes: string[], excludes: string[]): string {
  const parts: string[] = []

  for (const atom of includes) {
    const quoted = quoteIfNeeded(atom)
    if (quoted !== null) parts.push(quoted)
  }
  for (const atom of excludes) {
    const quoted = quoteIfNeeded(atom)
    if (quoted !== null) parts.push(`NOT ${quoted}`)
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
 *
 * Returns null if the atom is unrepresentable (contains both quote chars).
 */
export function toggleAtom(
  currentQuery: string,
  atom: string,
  knownAtoms: string[],
  shiftHeld: boolean = false,
): string | null {
  if (!isAtomRepresentable(atom)) return null

  const { includes, excludes, isCustom } = parseQuery(currentQuery, knownAtoms)

  if (isCustom) {
    // Custom mode — append term, but strip trailing operators first
    let trimmed = currentQuery.trim()
    // Strip trailing operators (AND, OR, NOT) repeatedly to prevent
    // "X OR AND Y" or "rock OR NOT AND jazz" malformation
    let prev = ""
    while (prev !== trimmed) {
      prev = trimmed
      trimmed = trimmed.replace(/\s+(AND|OR|NOT)\s*$/i, "").trim()
    }
    // Also handle bare trailing operator (e.g., just "OR")
    if (/^(AND|OR|NOT)$/i.test(trimmed)) {
      trimmed = ""
    }
    const quoted = quoteIfNeeded(atom)
    if (quoted === null) return null
    if (!trimmed) return quoted
    return `${trimmed} AND ${quoted}`
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

/**
 * Quote an atom for the Rust filter engine's grammar.
 *
 * Bare output: only for exact engine-safe identifiers ([A-Za-z_][A-Za-z0-9_:]*)
 * that are not AND/OR/NOT (case-insensitive).
 *
 * Quoted output:
 *   - "..." for atoms that need quoting and don't contain double quotes
 *   - '...' for atoms that contain double quotes (single-quote form)
 *   - null for atoms containing both quote chars (unrepresentable)
 */
function quoteIfNeeded(atom: string): string | null {
  // Unrepresentable: contains both quote characters
  if (atom.includes('"') && atom.includes("'")) {
    return null
  }

  // Bare-safe: engine grammar identifier, not an operator word
  if (isBareSafe(atom)) {
    return atom
  }

  // Must quote — prefer double quotes, use single if atom contains double
  if (atom.includes('"')) {
    return `'${atom}'`
  }
  return `"${atom}"`
}
