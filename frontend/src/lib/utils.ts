import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—"
  const totalSecs = Math.floor(seconds)
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let unitIndex = 0
  let size = bytes
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  // Show 1 decimal for MB/GB, 0 for B/KB
  const decimals = unitIndex >= 2 ? 1 : 0
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}

/** Return a color tag for file format badge styling */
export function formatColor(format: string | null | undefined): string {
  if (!format) return "default"
  const fmt = format.toLowerCase()
  if (fmt === "flac" || fmt === "m4a_alac" || fmt === "wav") return "lossless"
  if (fmt.includes("m4a") || fmt === "aac" || fmt === "ogg" || fmt === "opus") return "compressed"
  if (fmt === "mp3") return "mp3"
  return "default"
}

/** Return a quality description string for display */
export function qualityLabel(song: {
  file_format?: string | null
  bitrate?: number | null
  sample_rate?: number | null
  bit_depth?: number | null
}): string {
  const fmt = (song.file_format || "").toLowerCase()
  const isLossless = fmt === "flac" || fmt === "m4a_alac" || fmt === "wav" || fmt === "aiff" || fmt === "wv" || fmt === "ape"
  const isHiRes = isLossless && song.sample_rate && song.sample_rate > 48000

  // Hi-res: "96kHz / 24bit"
  if (isHiRes && song.sample_rate) {
    const khz = (song.sample_rate / 1000).toFixed(song.sample_rate % 1000 === 0 ? 0 : 1)
    let label = `${khz}kHz`
    if (song.bit_depth) label += ` / ${song.bit_depth}bit`
    return label
  }

  // Lossless: "Lossless" or with bitrate if available
  if (isLossless) {
    if (song.bitrate) return `Lossless · ${song.bitrate} kbps`
    return "Lossless"
  }

  // Lossy: show bitrate if available
  if (song.bitrate) return `${song.bitrate} kbps`
  return ""
}
