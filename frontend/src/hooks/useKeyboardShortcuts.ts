import { useEffect, useState, useCallback, useRef } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { useSongStore } from "@/stores/songStore"
import { usePlaylistStore } from "@/stores/playlistStore"

export function useKeyboardShortcuts() {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const isCommandPaletteOpenRef = useRef(false)

  // Keep ref in sync so the keydown handler doesn't need to re-attach
  isCommandPaletteOpenRef.current = isCommandPaletteOpen

  // Player actions
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const toggleMute = usePlayerStore((s) => s.toggleMute)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const volume = usePlayerStore((s) => s.volume)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)

  // Navigation
  const view = useSongStore((s) => s.view)
  const setView = useSongStore((s) => s.setView)
  const playlists = usePlaylistStore((s) => s.playlists)

  // Use refs for values that change but we don't want to re-attach listener for
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const viewRef = useRef(view)
  viewRef.current = view

  const openOverlay = useCallback(() => setIsOverlayOpen(true), [])
  const closeOverlay = useCallback(() => setIsOverlayOpen(false), [])
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null
      const tag = active?.tagName ?? ""
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        active?.isContentEditable === true

      const meta = e.metaKey || e.ctrlKey

      // Escape — close command palette, blur, allow dialog to handle rest
      if (e.key === "Escape") {
        if (isCommandPaletteOpenRef.current) {
          setIsCommandPaletteOpen(false)
          return
        }
        // Always blur on Escape, even when typing
        active?.blur()
        return
      }

      // ? — show keyboard shortcuts overlay (only when not typing)
      if (e.key === "?" && !meta && !e.shiftKey) {
        if (!isTyping) {
          e.preventDefault()
          setIsOverlayOpen(true)
        }
        return
      }

      // All remaining shortcuts only fire when NOT typing
      if (isTyping) return

      // Cmd/Ctrl+F — focus filter / Mix search input
      if (meta && e.key === "f" && !e.shiftKey) {
        e.preventDefault()
        if (viewRef.current.kind !== "filter") {
          setView({ kind: "filter" })
        }
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>(
            '.mix-query-bar input[type="text"]'
          )
          input?.focus()
        }, 50)
        return
      }

      // Cmd/Ctrl+K — command palette
      if (meta && e.key === "k" && !e.shiftKey) {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
        return
      }

      // Cmd/Ctrl+Shift+F — toggle fullscreen
      if (meta && e.shiftKey && e.key === "f") {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
        return
      }

      switch (e.code) {
        case "Space":
          e.preventDefault()
          togglePlay()
          break

        case "ArrowRight":
          e.preventDefault()
          next()
          break

        case "ArrowLeft":
          e.preventDefault()
          previous()
          break

        case "KeyM":
          toggleMute()
          break

        case "KeyN":
          next()
          break

        case "KeyP":
          previous()
          break

        case "KeyL":
          toggleShuffle()
          break

        case "KeyR":
          cycleRepeat()
          break

        case "KeyS":
          // Toggle settings panel
          setView(
            viewRef.current.kind === "settings"
              ? { kind: "all-songs" }
              : { kind: "settings" }
          )
          break

        case "BracketLeft":
          // Decrease volume by 5%
          setVolume(Math.max(0, volumeRef.current - 0.05))
          break

        case "BracketRight":
          // Increase volume by 5%
          setVolume(Math.min(1, volumeRef.current + 0.05))
          break

        case "Slash":
          e.preventDefault()
          if (viewRef.current.kind !== "filter") {
            setView({ kind: "filter" })
          }
          setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>(
              '.mix-query-bar input[type="text"]'
            )
            input?.focus()
          }, 50)
          break

        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8":
        case "Digit9": {
          const idx = parseInt(e.code.replace("Digit", ""), 10) - 1
          const pl = playlists[idx]
          if (pl) {
            setView({ kind: "playlist", playlistId: pl.id })
          }
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    togglePlay,
    next,
    previous,
    toggleMute,
    setVolume,
    cycleRepeat,
    toggleShuffle,
    setView,
    playlists,
  ])

  return {
    isOverlayOpen,
    isCommandPaletteOpen,
    openOverlay,
    closeOverlay,
    openCommandPalette,
    closeCommandPalette,
  }
}
