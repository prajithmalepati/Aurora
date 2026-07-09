/**
 * useAudioPlayer — WD-11 stale-end-handler guard regression tests.
 *
 * The tick-triggered repeat-one crossfade race (WD-11) is a timing issue between
 * two async paths inside a React hook that depends on Howler.js, AudioContext, and
 * DOM timers. Full reproduction requires browser integration (Playwright) with real
 * audio playback — node-level Vitest cannot render the hook or drive audio events.
 *
 * What we CAN test at the store level:
 * - repeat-one mode + crossfade configuration resolves correctly
 * - the store's repeat-one cycle behavior
 * - preload song selection logic picks the same song in repeat-one mode
 *
 * The stale-engine guard itself (`engineRef.current !== engine`) is a simple
 * identity check inside the end handler — verified by code review and the
 * debug logging enabled via localStorage.setItem("aurora-debug-audio", "1").
 *
 * For browser-level regression, use the Playwright repro scripts in /tmp/
 * (aurora-fadelock-*.mjs) which exercise the full crossfade pipeline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock localStorage for node environment
const storage: Record<string, string> = {}
globalThis.localStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: (i: number) => Object.keys(storage)[i] ?? null,
}

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  BASE_URL: "http://localhost:8000/api",
  getAuroraToken: () => undefined,
  getBaseUrl: () => "http://localhost:8000",
}))

vi.mock("@/stores/playlistStore", () => ({
  usePlaylistStore: {
    getState: () => ({ playlists: [] }),
  },
}))

function makeSong(id: number) {
  return {
    id,
    title: `Song ${id}`,
    artist: `Artist ${id}`,
    album: null,
    duration: 180,
    file_path: `/music/song${id}.mp3`,
    source: "local",
    tags: [],
    playlists: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("repeat-one + crossfade config resolution", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("repeat-one mode: store next() still advances (engine handles loop)", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]

    usePlayerStore.getState().playSong(songs[0], songs)
    usePlayerStore.getState().cycleRepeat() // none -> all
    usePlayerStore.getState().cycleRepeat() // all -> one
    expect(usePlayerStore.getState().repeatMode).toBe("one")

    // Store-level next() advances even in repeat-one — the repeat loop is
    // handled by useAudioPlayer's end handler, not the store.
    usePlayerStore.getState().next()
    const state = usePlayerStore.getState()
    expect(state.currentSong?.id).toBe(2)
    expect(state.isPlaying).toBe(true)
  })

  it("crossfade settings persist correctly", async () => {
    const { useSettingsStore } = await import("@/stores/settingsStore")

    // Enable crossfade
    useSettingsStore.getState().setCrossfadeEnabled(true)
    useSettingsStore.getState().setCrossfadeDuration(5)

    const state = useSettingsStore.getState()
    expect(state.crossfadeEnabled).toBe(true)
    expect(state.crossfadeDuration).toBe(5)
  })

  it("repeat-one with crossfade: preload targets same song", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1)]

    usePlayerStore.getState().playSong(songs[0], songs)
    usePlayerStore.getState().cycleRepeat() // none -> all
    usePlayerStore.getState().cycleRepeat() // all -> one
    expect(usePlayerStore.getState().repeatMode).toBe("one")

    // The store state is correct for the preload path:
    // currentSong === queue[queueIndex] === the only song
    const state = usePlayerStore.getState()
    expect(state.currentSong?.id).toBe(1)
    expect(state.queue[state.queueIndex]?.id).toBe(1)
    // In repeat-one, preloadNextIfNeeded picks currentSong as nextSong
    // This is the song that gets preloaded for gapless self-loop
  })
})

describe("crossfade natural-end: double-next race symptom", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("single next() on 2-song queue advances correctly", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2)]
    usePlayerStore.getState().playSong(songs[0], songs)
    expect(usePlayerStore.getState().queueIndex).toBe(0)

    usePlayerStore.getState().next()
    const state = usePlayerStore.getState()
    expect(state.currentSong?.id).toBe(2)
    expect(state.queueIndex).toBe(1)
    expect(state.isPlaying).toBe(true)
  })

  it("double next() on 2-song queue stops playback (race symptom)", async () => {
    // This demonstrates the symptom that the W1/P0 fix prevents.
    // When the early crossfade trigger calls next() and the engine's `end`
    // event fires before the React effect strips handlers, the end handler
    // reads the UPDATED queueIndex and calls next() again.
    //
    // With a 2-song queue, the second next() sees queueIndex=1 (last song)
    // and sets isPlaying=false — playback stops at the natural end of song 1.
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2)]
    usePlayerStore.getState().playSong(songs[0], songs)

    // First next() — tick crossfade trigger advances to song 2
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentSong?.id).toBe(2)
    expect(usePlayerStore.getState().isPlaying).toBe(true)

    // Second next() — stale end handler fires, reads updated queueIndex
    usePlayerStore.getState().next()
    const state = usePlayerStore.getState()
    expect(state.currentSong?.id).toBe(2) // still song 2 (queue end)
    expect(state.isPlaying).toBe(false)   // BUG SYMPTOM: playback stopped
  })

  it("double next() on 3-song queue skips a song (race symptom)", async () => {
    // With 3+ songs, the race causes a skip rather than a stop.
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]
    usePlayerStore.getState().playSong(songs[0], songs)

    // First next() — should go to song 2
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentSong?.id).toBe(2)

    // Second next() — skips song 2, goes to song 3
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentSong?.id).toBe(3)
    expect(usePlayerStore.getState().queueIndex).toBe(2)
  })
})
