const GRADIENTS = [
  "linear-gradient(135deg, #5eead4, #86efac)",
  "linear-gradient(135deg, #a78bfa, #f472b6)",
  "linear-gradient(135deg, #86efac, #5eead4)",
  "linear-gradient(135deg, #5eead4, #a78bfa)",
  "linear-gradient(135deg, #7dd3fc, #5eead4)",
  "linear-gradient(135deg, #c084fc, #a78bfa)",
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function playlistThumbnail(name: string): string {
  return GRADIENTS[hashString(name) % GRADIENTS.length]
}
