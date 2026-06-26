import { useEffect, useRef, useCallback } from "react"
import { useAddonStore } from "@/stores/addonStore"
import type { AddonSearchTrack } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Check, Cloud, WifiOff } from "lucide-react"
import { formatDuration } from "@/lib/utils"

interface OnlineResultsProps {
  searchQuery: string
}

export function OnlineResults({ searchQuery }: OnlineResultsProps) {
  const addons = useAddonStore((s) => s.addons)
  const searchResults = useAddonStore((s) => s.searchResults)
  const searchAll = useAddonStore((s) => s.searchAll)
  const clearSearch = useAddonStore((s) => s.clearSearch)
  const saveTrack = useAddonStore((s) => s.saveTrack)
  const savedRef = useRef<Set<string>>(new Set())

  const enabledAddons = addons.filter((a) => a.enabled)
  const hasResults = Object.keys(searchResults).length > 0

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2 || enabledAddons.length === 0) {
      clearSearch()
      return
    }
    const timer = setTimeout(() => {
      searchAll(searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, enabledAddons.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(
    async (addonId: string, track: AddonSearchTrack) => {
      const key = `${addonId}:${track.id}`
      if (savedRef.current.has(key)) return
      await saveTrack(addonId, track)
      savedRef.current.add(key)
    },
    [saveTrack]
  )

  if (!searchQuery.trim() || searchQuery.trim().length < 2 || enabledAddons.length === 0) {
    return null
  }

  if (!hasResults) {
    return null
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)]" />
        <span className="text-[12px] font-medium text-[var(--aurora-text-secondary)] tracking-wide uppercase">
          Online
        </span>
      </div>

      <div className="space-y-4">
        {enabledAddons.map((addon) => {
          const state = searchResults[addon.id]
          if (!state) return null

          return (
            <div key={addon.id}>
              {/* Addon header */}
              <p className="text-[11px] text-[var(--aurora-text-tertiary)] font-medium mb-1.5">
                {addon.name ?? addon.id}
              </p>

              {/* Loading skeletons */}
              {state.loading && (
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <Skeleton className="h-8 w-8 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4 rounded" />
                        <Skeleton className="h-2.5 w-1/2 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stale/offline notice */}
              {!state.loading && state.stale && (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[var(--aurora-text-tertiary)]">
                  <WifiOff className="h-3 w-3" />
                  <span>Temporarily unavailable</span>
                </div>
              )}

              {/* Error notice (non-stale) */}
              {!state.loading && state.error && !state.stale && (
                <p className="text-[11px] text-[var(--aurora-text-tertiary)] px-3 py-2">
                  Could not reach this source
                </p>
              )}

              {/* Track results */}
              {!state.loading && !state.error && state.tracks.length === 0 && (
                <p className="text-[11px] text-[var(--aurora-text-tertiary)] px-3 py-1">
                  No results
                </p>
              )}

              {!state.loading && state.tracks.length > 0 && (
                <div className="space-y-0.5">
                  {state.tracks.map((track) => (
                    <OnlineTrackRow
                      key={track.id}
                      addonId={addon.id}
                      addonName={addon.name ?? addon.id}
                      track={track}
                      isSaved={savedRef.current.has(`${addon.id}:${track.id}`)}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Single online track row ─────────────────────────────────────────────

function OnlineTrackRow({
  addonId,
  addonName,
  track,
  isSaved,
  onSave,
}: {
  addonId: string
  addonName: string
  track: AddonSearchTrack
  isSaved: boolean
  onSave: (addonId: string, track: AddonSearchTrack) => void
}) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--aurora-surface-hover)] transition-colors">
      {/* Artwork */}
      {track.artworkURL ? (
        <img
          src={track.artworkURL}
          alt=""
          className="h-8 w-8 rounded object-cover flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div
          className="h-8 w-8 rounded flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--aurora-surface-inset)" }}
        >
          <Cloud className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)]" />
        </div>
      )}

      {/* Title + artist + source chip */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--aurora-text)] truncate font-medium">
            {track.title}
          </span>
          {/* Source chip */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide flex-shrink-0"
            style={{
              background: "var(--aurora-surface-inset)",
              color: "var(--aurora-text-secondary)",
              border: "1px solid var(--aurora-rim)",
            }}
          >
            <Cloud className="h-2.5 w-2.5" />
            {addonName}
          </span>
        </div>
        <span className="text-[11px] text-[var(--aurora-text-secondary)] truncate block">
          {track.artist}
          {track.album && (
            <span className="text-[var(--aurora-text-tertiary)]"> · {track.album}</span>
          )}
        </span>
      </div>

      {/* Duration */}
      {track.duration != null && (
        <span className="text-[11px] tabular-nums text-[var(--aurora-text-tertiary)] flex-shrink-0">
          {formatDuration(track.duration)}
        </span>
      )}

      {/* Add to library */}
      <button
        onClick={() => onSave(addonId, track)}
        disabled={isSaved}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex-shrink-0 disabled:opacity-50"
        style={{
          background: isSaved ? "var(--aurora-surface-inset)" : "var(--aurora-accent-interactive)",
          color: isSaved ? "var(--aurora-text-tertiary)" : "var(--aurora-slate)",
        }}
      >
        {isSaved ? (
          <>
            <Check className="h-3 w-3" />
            <span>Added</span>
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </>
        )}
      </button>
    </div>
  )
}
