import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

const ROLLING_WINDOW = 30
const SPIKE_THRESHOLD = 0.3

// WeakMap cache — prevents double-wrapping the same <audio> element.
// createMediaElementSource throws if called twice on the same element.
const sourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

export function useAudioAnalyser(): number {
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rollingRef  = useRef<number[]>([])
  const rafRef      = useRef<number | null>(null)
  const isPlaying   = usePlayerStore(s => s.isPlaying)
  const currentId   = usePlayerStore(s => s.currentSong?.id)

  useEffect(() => {
    const Howler = (window as any).Howler
    if (!Howler?.ctx) return

    const ctx: AudioContext = Howler.ctx

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
      return
    }

    // Get the current Howl's underlying <audio> element.
    // Howler internals: Howler._howls[0] is the most recently created Howl.
    // Each Howl stores Sound objects in _sounds[]; the DOM node is _sounds[0]._node.
    const howl = Howler._howls?.[0]
    if (!howl) return
    const audioEl: HTMLAudioElement | undefined = howl._sounds?.[0]?._node
    if (!audioEl || !(audioEl instanceof HTMLAudioElement)) return

    // Get or create MediaElementAudioSourceNode (cached — must not call twice on same element)
    let source = sourceCache.get(audioEl)
    if (!source) {
      try {
        source = ctx.createMediaElementSource(audioEl)
        sourceCache.set(audioEl, source)
      } catch {
        return
      }
    }

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6

    // Route: source → analyser → destination (restores audio output)
    source.connect(analyser)
    analyser.connect(ctx.destination)

    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
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

    if (isPlaying) rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      // Disconnect analyser but leave source connected to ctx.destination
      // (source may be reused by next effect run for the same element)
      try { source!.disconnect(analyser) } catch {}
      try { analyser.disconnect() } catch {}
      analyserRef.current = null
      rollingRef.current = []
    }
  }, [currentId, isPlaying])

  return amplitude
}
