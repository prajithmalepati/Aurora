import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

// createMediaElementSource permanently mutes the <audio> element's direct output,
// rerouting audio exclusively through the Web Audio graph. Timing between
// when the graph is connected and when ctx resumes is unreliable from React effects,
// causing first-play and skip silence. Disabled until graph setup is colocated
// with Howl creation inside useAudioPlayer.ts.
export function useAudioAnalyser(): number {
  const isPlayingRef = useRef(false)
  const isPlaying = usePlayerStore(s => s.isPlaying)

  // Keep ctx alive when user presses play — required even without analyser,
  // because Howler html5:true does not call ctx.resume() itself.
  useEffect(() => {
    isPlayingRef.current = isPlaying
    if (isPlaying) {
      const ctx: AudioContext | undefined = (window as any).Howler?.ctx
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    }
  }, [isPlaying])

  return 0
}
