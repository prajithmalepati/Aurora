import { useAuroraColor } from '@/hooks/useAuroraColor'

// Null component: re-renders in isolation, never cascades up to App
export function AuroraColorBridge() {
  useAuroraColor()  // pure side effects: sets --song-color, --song-color-2
  return null
}
