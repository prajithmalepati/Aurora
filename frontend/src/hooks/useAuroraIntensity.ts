import { useEffect, useRef, useState } from 'react'
import { useSongStore } from '@/stores/songStore'
import { usePlayerStore } from '@/stores/playerStore'

const INTENSITY_MAP: Record<string, number> = {
  'all-songs': 0.20,
  'filter':    0.15,
  'playlist':  0.25,
  'settings':  0.15,
}

const NOW_PLAYING_INTENSITY = 0.80
const IDLE_INTENSITY        = 0.40
const IDLE_TIMEOUT_MS       = 30_000

export function useAuroraIntensity(): number {
  const view        = useSongStore(s => s.view)
  const currentSong = usePlayerStore(s => s.currentSong)
  // "expanded" = song is loaded — no separate isExpanded field in store
  const isExpanded  = currentSong !== null

  const [intensity, setIntensity] = useState(INTENSITY_MAP['all-songs'])

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref (not state) — idle flag updates on pointermove at 60fps.
  // useState here would flood the React scheduler with re-renders.
  const isIdleRef = useRef(false)

  // Idle timer — only setIntensity when value actually changes
  useEffect(() => {
    const getViewIntensity = () => INTENSITY_MAP[view.kind] ?? 0.20

    const markIdle = () => {
      if (isIdleRef.current) return
      isIdleRef.current = true
      if (!currentSong) setIntensity(IDLE_INTENSITY)
    }
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (isIdleRef.current) {
        isIdleRef.current = false
        setIntensity(isExpanded ? NOW_PLAYING_INTENSITY : getViewIntensity())
      }
      idleTimerRef.current = setTimeout(markIdle, IDLE_TIMEOUT_MS)
    }

    window.addEventListener('pointermove', resetIdle)
    window.addEventListener('keydown', resetIdle)
    resetIdle()
    return () => {
      window.removeEventListener('pointermove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [view, currentSong, isExpanded])

  // Derive intensity from view + song state (idle branch overrides above when active)
  useEffect(() => {
    if (isIdleRef.current && !currentSong) return
    if (isExpanded) {
      setIntensity(NOW_PLAYING_INTENSITY)
      return
    }
    setIntensity(INTENSITY_MAP[view.kind] ?? 0.20)
  }, [view, currentSong, isExpanded])

  return intensity
}
