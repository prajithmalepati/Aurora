import { useRef } from "react"
import { ImagePlus } from "lucide-react"
import { playlistThumbnail } from "@/lib/playlistImage"

interface PlaylistImagePickerProps {
  name: string
  imageDataUrl: string | null
  onImageChange: (dataUrl: string | null) => void
}

export function PlaylistImagePicker({ name, imageDataUrl, onImageChange }: PlaylistImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const gradient = playlistThumbnail(name || "untitled")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageChange(reader.result)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-16 h-16 rounded-md overflow-hidden group transition-all duration-150 hover:ring-1 hover:ring-[var(--aurora-rim-bright)]"
        style={!imageDataUrl ? { background: gradient } : undefined}
      >
        {imageDataUrl && (
          <img src={imageDataUrl} alt="" className="w-full h-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <ImagePlus className="h-5 w-5 text-white/80" />
        </span>
      </button>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[11px] text-[var(--aurora-teal)] hover:underline text-left"
        >
          Upload image
        </button>
        {imageDataUrl && (
          <button
            type="button"
            onClick={() => onImageChange(null)}
            className="text-[11px] text-[var(--aurora-text-muted)] hover:text-[var(--aurora-danger)] text-left transition-colors duration-150"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
