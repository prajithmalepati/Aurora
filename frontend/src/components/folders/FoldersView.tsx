import { useEffect, useState, useCallback } from "react"
import type { FolderNode, Song, FolderTreeResponse, FolderSongsResponse } from "@/types"
import { usePlayerStore } from "@/stores/playerStore"
import { api } from "@/lib/api"
import { SongTable } from "@/components/songs/SongTable"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, ChevronDown, FolderOpen, Home, Play, Shuffle } from "lucide-react"

interface FoldersViewProps { }

export function FoldersView({ }: FoldersViewProps) {
  const playSong = usePlayerStore((state) => state.playSong)

  // Folder tree state
  const [tree, setTree] = useState<FolderNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState<string | null>(null)

  // Navigation state
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([])

  // Song listing state
  const [songs, setSongs] = useState<Song[]>([])
  const [songsLoading, setSongsLoading] = useState(false)
  const [songsError, setSongsError] = useState<string | null>(null)
  const [recursive, setRecursive] = useState(true)

  // Tree expansion state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Fetch folder tree on mount, auto-select first leaf folder
  useEffect(() => {
    setTreeLoading(true)
    setTreeError(null)
    api.get<FolderTreeResponse>("/folders")
      .then((res) => {
        const folders = res.data.folders
        setTree(folders)
        setTreeLoading(false)
        // Auto-select first leaf folder so the page isn't blank
        const findFirstLeaf = (nodes: FolderNode[]): FolderNode | null => {
          for (const node of nodes) {
            if (!node.subfolders || node.subfolders.length === 0) return node
            const child = findFirstLeaf(node.subfolders)
            if (child) return child
          }
          return null
        }
        const firstLeaf = findFirstLeaf(folders)
        if (firstLeaf) {
          setCurrentPath(firstLeaf.path)
          // Also expand parents so the selected node is visible
          const expandParents = (nodes: FolderNode[], target: string, chain: string[]): boolean => {
            for (const node of nodes) {
              if (node.path === target) return true
              if (node.subfolders && expandParents(node.subfolders, target, [...chain, node.path])) {
                setExpandedPaths(prev => {
                  const next = new Set(prev)
                  for (const p of chain) next.add(p)
                  next.add(node.path)
                  return next
                })
                return true
              }
            }
            return false
          }
          expandParents(folders, firstLeaf.path, [])
        }
      })
      .catch((err) => {
        setTreeError(err.message)
        setTreeLoading(false)
      })
  }, [])

  // Fetch songs when currentPath changes
  useEffect(() => {
    if (!currentPath) {
      setSongs([])
      return
    }
    setSongsLoading(true)
    setSongsError(null)
    const params = new URLSearchParams({ path: currentPath, limit: "500" })
    if (recursive) params.set("recursive", "true")
    api
      .get<FolderSongsResponse>(`/folders/songs?${params.toString()}`)
      .then((res) => {
        setSongs(res.data)
        setSongsLoading(false)
      })
      .catch((err) => {
        setSongsError(err.message)
        setSongsLoading(false)
      })
  }, [currentPath, recursive])

  // Build breadcrumbs from current path
  useEffect(() => {
    if (!currentPath) {
      setBreadcrumbs([])
      return
    }
    const parts = currentPath.split("/").filter(Boolean)
    const crumbs: { name: string; path: string }[] = []
    let accumulated = ""
    for (const part of parts) {
      accumulated += "/" + part
      crumbs.push({ name: part, path: accumulated })
    }
    setBreadcrumbs(crumbs)
  }, [currentPath])

  const handlePlaySong = useCallback(
    (song: Song) => {
      playSong(song, songs)
    },
    [playSong, songs]
  )

  const handlePlayAll = useCallback(() => {
    if (songs.length === 0) return
    playSong(songs[0], songs)
  }, [songs, playSong])

  const handleShuffleAll = useCallback(() => {
    if (songs.length === 0) return
    const shuffled = [...songs].sort(() => Math.random() - 0.5)
    playSong(shuffled[0], shuffled)
  }, [songs, playSong])

  // Navigate to a folder
  const navigateToFolder = (path: string) => {
    setCurrentPath(path)
  }

  // Navigate via breadcrumb
  const navigateBreadcrumb = (index: number) => {
    const crumbs = currentPath
      ? currentPath.split("/").filter(Boolean)
      : []
    if (index < crumbs.length) {
      const newPath = "/" + crumbs.slice(0, index + 1).join("/")
      setCurrentPath(newPath)
    }
  }

  // Go back to tree root
  const goToRoot = () => {
    setCurrentPath(null)
  }

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Render a folder node in the tree
  const renderFolderNode = (node: FolderNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path)
    const hasSubfolders = node.subfolders && node.subfolders.length > 0

    return (
      <div key={node.path}>
        <button
          onClick={() => {
            if (hasSubfolders) {
              toggleExpand(node.path)
            }
            navigateToFolder(node.path)
          }}
          className={`group relative w-full flex items-center gap-2 px-3 py-[6px] rounded-md text-left text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150 ${
            currentPath === node.path
              ? "text-[var(--aurora-text)] bg-white/[0.05]"
              : ""
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <span
            className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
            style={{ background: "var(--aurora-surface-hover)" }}
            aria-hidden="true"
          />
          <span className="relative z-10 flex-shrink-0">
            {hasSubfolders ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--aurora-text-tertiary)]" strokeWidth={1.5} />
              )
            ) : (
              <span className="block w-3.5" />
            )}
          </span>
          <span className="relative z-10 flex-shrink-0 text-[var(--aurora-text-tertiary)]">
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
          </span>
          <span className="relative z-10 flex-1 min-w-0 truncate text-[13px] font-medium tracking-tight">
            {node.name}
          </span>
          <span className="relative z-10 text-[10px] tabular-nums text-[var(--aurora-text-tertiary)] group-hover:text-[var(--aurora-text-secondary)] transition-colors duration-150">
            {node.song_count}
          </span>
        </button>
        {isExpanded && hasSubfolders && (
          <div>
            {node.subfolders!.map((sub) => renderFolderNode(sub, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Folder tree sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0 max-h-[35vh] lg:max-h-none border-b lg:border-b-0 lg:border-r border-[var(--aurora-muted)]/40 flex flex-col lg:h-full">
        <div className="px-4 pt-6 pb-3">
          <h2 className="font-display text-[18px] leading-none tracking-tight text-[var(--aurora-text)]">
            Folders
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-1 pb-4">
          {treeLoading ? (
            <div className="space-y-1 px-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          ) : treeError ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] text-[var(--aurora-danger)]">
                Failed to load folders
              </p>
            </div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
                No songs in library
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => renderFolderNode(node))}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="p-4 sm:px-10 sm:pt-8 sm:pb-6 max-w-[1400px] mx-auto w-full flex flex-col min-h-0 h-full">
          {currentPath ? (
            <>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 mb-4 text-[13px] shrink-0">
                <button
                  onClick={goToRoot}
                  className="flex items-center gap-1 text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
                >
                  <Home className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1.5">
                    <span className="text-[var(--aurora-text-tertiary)]">/</span>
                    {i === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-[var(--aurora-text)]">
                        {crumb.name}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigateBreadcrumb(i)}
                        className="text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] transition-colors duration-150"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {/* Header with Play All and Recursive toggle */}
              <div className="flex items-center justify-between mb-5 shrink-0 gap-3 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-[24px] leading-none tracking-tight text-[var(--aurora-text)] truncate">
                    {breadcrumbs.length > 0
                      ? breadcrumbs[breadcrumbs.length - 1].name
                      : currentPath.split("/").filter(Boolean).pop() || "Folder"}
                  </h1>

                </div>
                <div className="flex items-center gap-3">
                  {/* Recursive toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={recursive}
                      onChange={(e) => setRecursive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <span
                      className="w-8 h-4 rounded-full relative transition-colors duration-200 peer-checked:bg-[var(--aurora-accent-interactive)]"
                      style={{ background: recursive ? "var(--aurora-accent-interactive)" : "var(--aurora-muted)" }}
                    >
                      <span
                        className="w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 peer-checked:translate-x-4"
                      />
                    </span>
                    <span className="text-[11px] text-[var(--aurora-text-secondary)]">Subfolders</span>
                  </label>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-[12px]"
                    onClick={handleShuffleAll}
                    disabled={songs.length === 0}
                  >
                    <Shuffle className="h-3 w-3" strokeWidth={1.5} />
                    Shuffle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-[12px]"
                    onClick={handlePlayAll}
                    disabled={songs.length === 0}
                  >
                    <Play className="h-3 w-3" fill="currentColor" />
                    Play Folder
                  </Button>
                </div>
              </div>

              {/* Song table */}
              <SongTable
              columnContext="folder"
                songs={songs}
                loading={songsLoading}
                error={songsError}
                onPlay={handlePlaySong}
                disableInfiniteScroll
                fillHeight
              />
            </>
          ) : (
            <>
              {/* Empty state - no folder selected */}
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--aurora-surface)" }}
                >
                  <FolderOpen
                    className="h-8 w-8 text-[var(--aurora-text-tertiary)]"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="font-display text-[20px] text-[var(--aurora-text)]">
                  Browse by Folder
                </p>
                <p className="text-[13px] text-[var(--aurora-text-secondary)] max-w-xs text-center leading-relaxed">
                  Select a folder from the tree to view its songs. Your music is organized by file system folders.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
