/**
 * Three-state tag chip logic for QueryBuilder.
 *
 * Tests the pure functions that power chip state detection, canonical
 * query rewriting, and the toggleAtom action (neutral → included →
 * excluded → neutral cycle, shift-click direct exclude).
 *
 * Brief: G3/E1 — Three-state tag chips
 */
import { describe, it, expect } from "vitest"
import {
  parseChipStates,
  canonicalizeQuery,
  toggleAtom,
} from "@/lib/chipState"

describe("parseChipStates", () => {
  const atoms = ["rock", "gym", "late night", "classical"]

  it("returns all neutral for empty query", () => {
    const result = parseChipStates("", atoms)
    expect(result.states.get("rock")).toBe("neutral")
    expect(result.states.get("gym")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })

  it("parses a single included atom", () => {
    const result = parseChipStates("rock", atoms)
    expect(result.states.get("rock")).toBe("included")
    expect(result.states.get("gym")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })

  it("parses multiple included atoms", () => {
    const result = parseChipStates("rock AND gym", atoms)
    expect(result.states.get("rock")).toBe("included")
    expect(result.states.get("gym")).toBe("included")
    expect(result.states.get("classical")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })

  it("parses excluded atoms with NOT keyword", () => {
    const result = parseChipStates("NOT classical", atoms)
    expect(result.states.get("classical")).toBe("excluded")
    expect(result.states.get("rock")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })

  it("parses mixed includes and excludes", () => {
    const result = parseChipStates('gym AND "late night" AND NOT classical', atoms)
    expect(result.states.get("gym")).toBe("included")
    expect(result.states.get("late night")).toBe("included")
    expect(result.states.get("classical")).toBe("excluded")
    expect(result.states.get("rock")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })

  it("parses quoted multi-word atoms correctly", () => {
    const result = parseChipStates('"late night"', atoms)
    expect(result.states.get("late night")).toBe("included")
    expect(result.isCustom).toBe(false)
  })

  it("detects custom mode for OR expression", () => {
    const result = parseChipStates("rock OR gym", atoms)
    expect(result.isCustom).toBe(true)
    // All chips should be neutral in custom mode
    expect(result.states.get("rock")).toBe("neutral")
    expect(result.states.get("gym")).toBe("neutral")
  })

  it("detects custom mode for parentheses", () => {
    const result = parseChipStates("(rock AND gym)", atoms)
    expect(result.isCustom).toBe(true)
    expect(result.states.get("rock")).toBe("neutral")
  })

  it("detects custom mode for unknown terms", () => {
    const result = parseChipStates("rock AND unknown_tag", atoms)
    expect(result.isCustom).toBe(true)
    expect(result.states.get("rock")).toBe("neutral")
  })

  it("does NOT treat tag 'band' as AND operator (token boundary)", () => {
    const bandAtoms = ["band", "rock"]
    const result = parseChipStates("band", bandAtoms)
    expect(result.states.get("band")).toBe("included")
    expect(result.isCustom).toBe(false)
  })

  it("does NOT treat tag containing 'not' as NOT operator", () => {
    const notAtoms = ["nothing", "rock"]
    const result = parseChipStates("nothing", notAtoms)
    expect(result.states.get("nothing")).toBe("included")
    expect(result.isCustom).toBe(false)
  })

  it("handles query with only excludes", () => {
    const result = parseChipStates("NOT rock AND NOT gym", atoms)
    expect(result.states.get("rock")).toBe("excluded")
    expect(result.states.get("gym")).toBe("excluded")
    expect(result.states.get("classical")).toBe("neutral")
    expect(result.isCustom).toBe(false)
  })
})

describe("canonicalizeQuery", () => {
  it("returns empty string for no atoms", () => {
    expect(canonicalizeQuery([], [])).toBe("")
  })

  it("produces single included atom unquoted", () => {
    expect(canonicalizeQuery(["rock"], [])).toBe("rock")
  })

  it("quotes multi-word included atoms", () => {
    expect(canonicalizeQuery(["late night"], [])).toBe('"late night"')
  })

  it("joins multiple includes with AND", () => {
    expect(canonicalizeQuery(["rock", "gym"], [])).toBe("rock AND gym")
  })

  it("produces NOT keyword for excludes", () => {
    expect(canonicalizeQuery([], ["classical"])).toBe("NOT classical")
  })

  it("places includes before excludes", () => {
    expect(canonicalizeQuery(["gym"], ["classical"])).toBe("gym AND NOT classical")
  })

  it("handles multiple includes and excludes in canonical order", () => {
    const result = canonicalizeQuery(["gym", "late night"], ["classical", "rock"])
    expect(result).toBe('gym AND "late night" AND NOT classical AND NOT rock')
  })

  it("quotes multi-word excludes", () => {
    expect(canonicalizeQuery([], ["late night"])).toBe('NOT "late night"')
  })
})

describe("toggleAtom", () => {
  const atoms = ["rock", "gym", "late night", "classical"]

  it("adds atom as included when query is empty (neutral→included)", () => {
    const result = toggleAtom("", "rock", atoms)
    expect(result).toBe("rock")
  })

  it("appends second atom with AND (neutral→included)", () => {
    const result = toggleAtom("rock", "gym", atoms)
    expect(result).toBe("rock AND gym")
  })

  it("cycles included→excluded on second click", () => {
    const result = toggleAtom("rock AND gym", "rock", atoms)
    expect(result).toBe("gym AND NOT rock")
  })

  it("cycles excluded→neutral (removes) on third click", () => {
    const result = toggleAtom("gym AND NOT rock", "rock", atoms)
    expect(result).toBe("gym")
  })

  it("shift-click directly excludes (neutral→excluded)", () => {
    const result = toggleAtom("gym", "classical", atoms, true)
    expect(result).toBe("gym AND NOT classical")
  })

  it("shift-click on already-included atom goes to excluded", () => {
    const result = toggleAtom("rock AND gym", "rock", atoms, true)
    expect(result).toBe("gym AND NOT rock")
  })

  it("shift-click on excluded atom cycles to neutral (removes)", () => {
    const result = toggleAtom("gym AND NOT classical", "classical", atoms, true)
    expect(result).toBe("gym")
  })

  it("preserves canonical order after toggle (includes first, then excludes)", () => {
    // Start: gym AND NOT classical. Toggle rock → included
    const result = toggleAtom("gym AND NOT classical", "rock", atoms)
    expect(result).toBe("gym AND rock AND NOT classical")
  })

  it("quotes multi-word atoms in output", () => {
    const result = toggleAtom("", "late night", atoms)
    expect(result).toBe('"late night"')
  })

  it("falls back to appendTerm behavior in custom mode", () => {
    // If the query contains OR/parens/unknown, it's custom — toggleAtom should
    // still work but produce a new query that may or may not be canonical.
    // The custom-mode flag is handled at the UI layer, not here.
    const result = toggleAtom("rock OR gym", "classical", atoms)
    // Should still produce a valid canonical result for the atoms it knows about
    // But since the input is custom, we just append
    expect(result).toContain("classical")
  })
})
