import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

const ROLLING_WINDOW = 30
const SPIKE_THRESHOLD = 0.3

// WeakMap caches — one entry per <audio> element, survives song changes.
// createMediaElementSource throws if called twice on the same element.
const sourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()
// GainNode passthrough: source → gain → destination stays live forever.
// Analyser is a separate tap — only it is disconnected/reconnected on song change.
const gainCache = new WeakMap<HTMLAudioElement, GainNode>()

export function useAudioAnalyser(): number {
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const rollingRef    = useRef<number[]>([])
  const rafRef        = useRef<number | null>(null)
  const isPlayingRef  = useRef(false)

  const isPlaying = usePlayerStore(s => s.isPlaying)
  const currentId = usePlayerStore(s => s.currentSong?.id)

  // Keep isPlayingRef current so the RAF tick can self-gate without effect deps on isPlaying.
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Analyser graph — rebuilds once per song (currentId), not per pause/play.
  useEffect(() => {
    let cancelled = false
    let cleanupFn: (() => void) | undefined

    const setup = async () => {
      const Howler = (window as any).Howler
      if (!Howler?.ctx) return

      const ctx: AudioContext = Howler.ctx

      // Await resume so we never return with the context still suspended.
      if (ctx.state === 'suspended') {
        try { await ctx.resume() } catch { return }
      }
      if (cancelled) return

      const howl = Howler._howls?.[0]
      if (!howl) return
      const audioEl: HTMLAudioElement | undefined = howl._sounds?.[0]?._node
      if (!audioEl || !(audioEl instanceof HTMLAudioElement)) return

      // Source node — cached, must not be created twice for the same element.
      let source = sourceCache.get(audioEl)
      if (!source) {
        try {
          source = ctx.createMediaElementSource(audioEl)
          sourceCache.set(audioEl, source)
        } catch { return }
      }

      // GainNode passthrough — cached, connected once, never disconnected.
      // source → gain → destination stays live across all analyser rebuilds.
      let gain = gainCache.get(audioEl)
      if (!gain) {
        gain = ctx.createGain()
        gain.gain.value = 1.0
        source.connect(gain)
        gain.connect(ctx.destination)
        gainCache.set(audioEl, gain)
      }

      if (cancelled) return

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6

      // Tap: source → analyser (separate from the gain path, so cleanup never touches gain).
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        if (!isPlayingRef.current) {
          // Not playing — keep RAF alive but skip computation.
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

      // Re-connect analyser if ctx suspends and resumes mid-session.
      const onStateChange = () => {
        if (ctx.state === 'running' && analyserRef.current) {
          try { source!.connect(analyserRef.current) } catch {}
        }
      }
      ctx.addEventListener('statechange', onStateChange)

      cleanupFn = () => {
        ctx.removeEventListener('statechange', onStateChange)
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        // Only disconnect the analyser tap — gain passthrough stays live.
        try { source!.disconnect(analyser) } catch {}
        try { analyser.disconnect() } catch {}
        analyserRef.current = null
        rollingRef.current = []
        setAmplitude(0)
      }
    }

    setup()

    return () => {
      cancelled = true
      cleanupFn?.()
    }
  }, [currentId])

  return amplitude
}
