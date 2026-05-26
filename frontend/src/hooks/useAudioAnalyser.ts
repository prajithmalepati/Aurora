import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

const ROLLING_WINDOW = 30
const SPIKE_THRESHOLD = 0.3

// WeakMap caches — one entry per <audio> element, survive song changes.
// createMediaElementSource throws if called twice on the same element.
const sourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()
// GainNode passthrough: source → gain → destination stays live forever.
// Analyser is a side tap — only it is disconnected on song change.
const gainCache = new WeakMap<HTMLAudioElement, GainNode>()

export function useAudioAnalyser(): number {
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const rollingRef   = useRef<number[]>([])
  const rafRef       = useRef<number | null>(null)
  const isPlayingRef = useRef(false)

  const isPlaying = usePlayerStore(s => s.isPlaying)
  const currentId = usePlayerStore(s => s.currentSong?.id)

  // Sync isPlayingRef without re-running the analyser effect.
  // Also try to resume ctx here — this fires close to the user's play gesture.
  useEffect(() => {
    isPlayingRef.current = isPlaying
    if (isPlaying) {
      const Howler = (window as any).Howler
      if (Howler?.ctx?.state === 'suspended') {
        Howler.ctx.resume().catch(() => {})
      }
    }
  }, [isPlaying])

  // Analyser graph — rebuilds once per song (currentId), not per pause/play.
  useEffect(() => {
    const Howler = (window as any).Howler
    if (!Howler?.ctx) return

    const ctx: AudioContext = Howler.ctx

    // Fire-and-forget resume — don't block or await.
    // Graph nodes can be created and connected on a suspended ctx.
    // Audio flows once ctx transitions to running.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const howl = Howler._howls?.[0]
    if (!howl) return
    const audioEl: HTMLAudioElement | undefined = howl._sounds?.[0]?._node
    if (!audioEl || !(audioEl instanceof HTMLAudioElement)) return

    // Source node — cached per element, must never be created twice.
    let source = sourceCache.get(audioEl)
    if (!source) {
      try {
        source = ctx.createMediaElementSource(audioEl)
        sourceCache.set(audioEl, source)
      } catch { return }
    }

    // GainNode passthrough — cached per element, connected once, never disconnected.
    // source → gain → destination stays live across all analyser rebuilds and ctx suspensions.
    // When ctx resumes, this path becomes active automatically (connections persist).
    let gain = gainCache.get(audioEl)
    if (!gain) {
      gain = ctx.createGain()
      gain.gain.value = 1.0
      source.connect(gain)
      gain.connect(ctx.destination)
      gainCache.set(audioEl, gain)
    }

    // Analyser tap — separate from gain path, disconnected on cleanup.
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      if (!isPlayingRef.current) {
        // Not playing — keep RAF alive, skip computation.
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 1; i <= 20; i++) sum += data[i]
      const norm = sum / (20 * 255)

      const rolling = rollingRef.current
      rolling.push(norm)
      if (rolling.length > ROLLING_WINDOW) rolling.shift()
      const avg = rolling.reduce((a, b) => a + b, 0) / rolling.length
      const spike = norm - avg > SPIKE_THRESHOLD ? norm - avg : 0
      setAmplitude(spike)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    // Resume ctx proactively when browser suspends it mid-session (tab switch, etc.)
    const onStateChange = () => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
    }
    ctx.addEventListener('statechange', onStateChange)

    return () => {
      ctx.removeEventListener('statechange', onStateChange)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      // Disconnect analyser tap only — gain passthrough stays live.
      try { source!.disconnect(analyser) } catch {}
      try { analyser.disconnect() } catch {}
      analyserRef.current = null
      rollingRef.current = []
      setAmplitude(0)
    }
  }, [currentId])

  return amplitude
}
