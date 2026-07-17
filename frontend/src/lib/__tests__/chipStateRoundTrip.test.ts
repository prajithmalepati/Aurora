/// <reference types="node" />
/**
 * Cross-runtime round-trip tests for chip emission → Rust filter engine.
 *
 * These tests verify that every query string emitted by chipState.ts functions
 * (canonicalizeQuery, toggleAtom) is accepted by the real Rust aurora_core::filter::parse.
 *
 * The bridge: a minimal Rust binary (filter_check) that exits 0 on parse success.
 *
 * Brief: G3/Q9 F1 — chip emission must round-trip the real Rust filter engine
 */
import { describe, it, expect } from "vitest"
import { execFileSync } from "child_process"
import { existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import {
  canonicalizeQuery,
  toggleAtom,
  parseChipStates,
  isAtomRepresentable,
} from "@/lib/chipState"

// Path to the filter_check binary — built by `cargo build -p aurora_core --bin filter_check`
const __dirname = dirname(fileURLToPath(import.meta.url))
const RUST_WORKSPACE = resolve(__dirname, "../../../../rust")
const FILTER_CHECK_BIN = resolve(RUST_WORKSPACE, "target/debug/filter_check")

function filterCheck(query: string): { ok: boolean; stderr: string } {
  if (!existsSync(FILTER_CHECK_BIN)) {
    throw new Error(
      `filter_check binary not found at ${FILTER_CHECK_BIN}. ` +
      `Build it with: cd ${RUST_WORKSPACE} && cargo build -p aurora_core --bin filter_check`
    )
  }
  try {
    execFileSync(FILTER_CHECK_BIN, [query], {
      encoding: "utf-8",
      timeout: 5000,
    })
    return { ok: true, stderr: "" }
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    return { ok: false, stderr: e.stderr ?? e.stdout ?? e.message ?? "unknown error" }
  }
}

// ── F1 corpus: canonicalizeQuery output ──────────────────────────────────

describe("F1: canonicalizeQuery output round-trips real Rust parser", () => {
  const corpus: Array<{
    name: string
    includes: string[]
    excludes: string[]
  }> = [
    { name: "bare identifier", includes: ["rock"], excludes: [] },
    { name: "multi-word", includes: ["late night"], excludes: [] },
    { name: "lowercase operator word as atom", includes: ["and"], excludes: [] },
    { name: "apostrophe atom 90's", includes: ["90's"], excludes: [] },
    { name: "apostrophe atom don't", includes: ["don't"], excludes: [] },
    { name: "paren atom (live)", includes: ["(live)"], excludes: [] },
    { name: "hyphen atom lo-fi", includes: ["lo-fi"], excludes: [] },
    { name: "leading digit 2024", includes: ["2024"], excludes: [] },
    { name: "double-quote atom", includes: ['a"b'], excludes: [] },
    { name: "mixed include + exclude", includes: ["rock", "gym"], excludes: ["classical"] },
    { name: "multi-word exclude", includes: [], excludes: ["late night"] },
    { name: "bare underscore", includes: ["my_tag"], excludes: [] },
    { name: "bare colon", includes: ["tag:rock"], excludes: [] },
  ]

  for (const { name, includes, excludes } of corpus) {
    it(`canonicalizeQuery [${name}]`, () => {
      const query = canonicalizeQuery(includes, excludes)
      expect(query).not.toBe("")
      const { ok, stderr } = filterCheck(query)
      expect(ok).toBe(true)
      if (!ok) {
        console.error(`Query: ${query}\nStderr: ${stderr}`)
      }
    })
  }
})

// ── F1 corpus: toggleAtom output ─────────────────────────────────────────

describe("F1: toggleAtom output round-trips real Rust parser", () => {
  const atoms = [
    "rock", "gym", "late night", "classical",
    "and", "or", "not", "90's", "don't", "(live)", "lo-fi", "2024",
  ]

  it("toggleAtom from empty → each atom individually", () => {
    for (const atom of atoms) {
      const result = toggleAtom("", atom, atoms)
      expect(result).not.toBeNull()
      if (result === null) continue // unrepresentable — tested separately
      const { ok, stderr } = filterCheck(result)
      expect(ok).toBe(true)
      if (!ok) {
        console.error(`Atom: ${atom}, Query: ${result}\nStderr: ${stderr}`)
      }
    }
  })

  it("toggleAtom accumulates multiple atoms", () => {
    let query = ""
    for (const atom of ["rock", "gym", "late night"]) {
      const result = toggleAtom(query, atom, atoms)
      expect(result).not.toBeNull()
      if (result === null) continue
      query = result
    }
    const { ok, stderr } = filterCheck(query)
    expect(ok).toBe(true)
    if (!ok) {
      console.error(`Query: ${query}\nStderr: ${stderr}`)
    }
  })

  it("toggleAtom exclude cycle produces parseable output", () => {
    // Include rock, then click again → exclude
    let query = toggleAtom("", "rock", atoms) ?? ""
    query = toggleAtom(query, "rock", atoms) ?? query
    const { ok, stderr } = filterCheck(query)
    expect(ok).toBe(true)
    if (!ok) {
      console.error(`Query: ${query}\nStderr: ${stderr}`)
    }
  })

  it("toggleAtom in custom mode with trailing operators", () => {
    // Simulate custom mode: "rock OR NOT" → append jazz
    const result = toggleAtom("rock OR NOT", "jazz", atoms)
    expect(result).not.toBeNull()
    if (result === null) return
    expect(result).not.toContain("OR AND")
    const { ok, stderr } = filterCheck(result)
    expect(ok).toBe(true)
    if (!ok) {
      console.error(`Query: ${result}\nStderr: ${stderr}`)
    }
  })
})

// ── F1: parseChipStates round-trip ──────────────────────────────────────

describe("F1: parseChipStates recovers state from own emission", () => {
  const atoms = ["rock", "gym", "late night", "classical", "and", "90's", "lo-fi"]

  it("round-trip: included atom recovered from canonicalized query", () => {
    for (const atom of atoms) {
      const query = canonicalizeQuery([atom], [])
      const { states, isCustom } = parseChipStates(query, atoms)
      expect(isCustom).toBe(false)
      expect(states.get(atom)).toBe("included")
    }
  })

  it("round-trip: excluded atom recovered from canonicalized query", () => {
    for (const atom of atoms) {
      const query = canonicalizeQuery([], [atom])
      const { states, isCustom } = parseChipStates(query, atoms)
      expect(isCustom).toBe(false)
      expect(states.get(atom)).toBe("excluded")
    }
  })

  it("round-trip: mixed include/exclude recovered", () => {
    const query = canonicalizeQuery(["rock", "late night"], ["classical"])
    const { states, isCustom } = parseChipStates(query, atoms)
    expect(isCustom).toBe(false)
    expect(states.get("rock")).toBe("included")
    expect(states.get("late night")).toBe("included")
    expect(states.get("classical")).toBe("excluded")
    expect(states.get("gym")).toBe("neutral")
  })
})

// ── F1: unrepresentable atoms ───────────────────────────────────────────

describe("F1: unrepresentable atoms", () => {
  it("atom with both quote chars is unrepresentable", () => {
    expect(isAtomRepresentable('a"b\'c')).toBe(false)
  })

  it("atom with only double quote is representable (single-quote form)", () => {
    expect(isAtomRepresentable('a"b')).toBe(true)
  })

  it("atom with only single quote is representable (double-quote form)", () => {
    expect(isAtomRepresentable("a'b")).toBe(true)
  })

  it("toggleAtom returns null for unrepresentable atom", () => {
    const result = toggleAtom("", 'a"b\'c', ["a\"b'c"])
    expect(result).toBeNull()
  })

  it("canonicalizeQuery skips unrepresentable atoms", () => {
    const result = canonicalizeQuery(["rock", 'a"b\'c'], ["gym"])
    expect(result).toContain("rock")
    expect(result).toContain("gym")
    expect(result).not.toContain("a\"b'c")
  })
})

// ── F1: bare-safe vs quoted output ───────────────────────────────────────

describe("F1: bare-safe vs quoted output", () => {
  it("simple identifier stays bare", () => {
    expect(canonicalizeQuery(["rock"], [])).toBe("rock")
  })

  it("hyphen atom gets quoted", () => {
    const q = canonicalizeQuery(["lo-fi"], [])
    expect(q).toBe('"lo-fi"')
  })

  it("leading digit gets quoted", () => {
    const q = canonicalizeQuery(["2024"], [])
    expect(q).toBe('"2024"')
  })

  it("apostrophe gets quoted", () => {
    const q = canonicalizeQuery(["90's"], [])
    expect(q).toBe('"90\'s"')
  })

  it("paren gets quoted", () => {
    const q = canonicalizeQuery(["(live)"], [])
    expect(q).toBe('"(live)"')
  })

  it("operator word 'and' gets quoted", () => {
    const q = canonicalizeQuery(["and"], [])
    expect(q).toBe('"and"')
  })

  it("double-quote atom uses single-quote form", () => {
    const q = canonicalizeQuery(['a"b'], [])
    expect(q).toBe("'a\"b'")
  })

  it("all quoted forms parse in real engine", () => {
    const cases = [
      canonicalizeQuery(["lo-fi"], []),
      canonicalizeQuery(["2024"], []),
      canonicalizeQuery(["90's"], []),
      canonicalizeQuery(["(live)"], []),
      canonicalizeQuery(["and"], []),
      canonicalizeQuery(['a"b'], []),
    ]
    for (const query of cases) {
      const { ok, stderr } = filterCheck(query)
      expect(ok).toBe(true)
      if (!ok) {
        console.error(`Query: ${query}\nStderr: ${stderr}`)
      }
    }
  })
})
