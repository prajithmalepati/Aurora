import { useState, useEffect, useRef } from "react"
import { albumGradient } from "@/lib/albumGradient"
import { getBaseUrl } from "@/lib/api"

const ALBUM_ART_BASE = `${getBaseUrl()}/api/album-art`

const SIZE_CLASSES: Record<string, string> = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-[120px] h-[120px]",
  fill: "w-full h-full",
}

interface AlbumArtProps {
  song: { id?: number; title?: string; album_art_path?: string | null }
  size: "sm" | "md" | "lg" | "fill"
  className?: string
  style?: React.CSSProperties
}

export function AlbumArt({ song, size, className = "", style }: AlbumArtProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const art = albumGradient(song.id ?? song.title ?? "void")
  const src = song.album_art_path ? `${ALBUM_ART_BASE}/${song.album_art_path}` : undefined
  const showImg = !!src && !error

  useEffect(() => {
    setError(false)
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true)
    } else {
      setLoaded(false)
    }
  }, [src])

  return (
    <div
      className={`relative ${SIZE_CLASSES[size]} rounded-md flex-shrink-0 overflow-hidden ${className}`}
      style={{ background: art.background, ...style }}
      aria-hidden="true"
    >
      {showImg && (
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
        />
      )}
    </div>
  )
}
