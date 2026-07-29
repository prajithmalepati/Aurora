import { describe, it, expect } from "vitest"

import { buildUpdatePatch } from "./SaveSmartPlaylistDialog"

describe("buildUpdatePatch", () => {
  it("includes the current query in the update patch", () => {
    const patch = buildUpdatePatch({
      name: "My Playlist",
      color: "#5eead4",
      emoji: "🎸",
      query: 'genre is "rock" and bpm > 120',
    })

    expect(patch).toEqual({
      name: "My Playlist",
      color: "#5eead4",
      emoji: "🎸",
      query: 'genre is "rock" and bpm > 120',
    })
  })

  it("converts empty color/emoji to null", () => {
    const patch = buildUpdatePatch({
      name: "Minimal",
      color: "",
      emoji: "",
      query: "artist is foo",
    })

    expect(patch).toEqual({
      name: "Minimal",
      color: null,
      emoji: null,
      query: "artist is foo",
    })
  })

  it("trims name", () => {
    const patch = buildUpdatePatch({
      name: "  Padded  ",
      color: "#f87171",
      emoji: "🔥",
      query: "year > 2020",
    })

    expect(patch.name).toBe("Padded")
  })
})
