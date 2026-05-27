import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * Drives the 400ms song-change choreography.
 * useEffectEvent does not exist in stable React 19 release — use useRef + latest-ref pattern instead.
 *
 * Timeline:
 *   t=0ms:     song changes
 *   t=200ms:   waveform peaks swap (onSwapPeaks called)
 *   t=400ms:   transition complete
 */
export function useSongTransition(onSwapPeaks: () => void) {
  const currentSongId = usePlayerStore(s => s.currentSong?.id)
  const prevIdRef = useRef<number | undefined>(undefined)
  const rafRef = useRef<number | null>(null)
  // Latest-ref pattern — always calls the current onSwapPeaks without re-running the effect
  const onSwapPeaksRef = useRef(onSwapPeaks)
  onSwapPeaksRef.current = onSwapPeaks

  useEffect(() => {
    if (currentSongId === prevIdRef.current) return
    prevIdRef.current = currentSongId

    const start = performance.now()
    let swapped = false

    const tick = (now: number) => {
      const elapsed = now - start
      if (!swapped && elapsed >= 200) {
        swapped = true
        onSwapPeaksRef.current()
      }
      if (elapsed < 400) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [currentSongId])
}
