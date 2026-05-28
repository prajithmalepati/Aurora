import { useFilterStore } from "@/stores/filterStore"
import { useTagStore } from "@/stores/tagStore"
import { useMemo, useState, useRef } from "react"
import { Check, X } from "lucide-react"
import type { SuggestionItem } from "./AutocompleteDropdown"
import type { Tag } from "@/types"

export function validateQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false

  let depth = 0
  const tokens = trimmed.match(/(".*?"|[^\s]+)/g)
  if (!tokens) return false

  const operators = new Set(["AND", "OR", "NOT"])
  let expectTerm = true

  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (upper === "(") {
      if (!expectTerm) return false
      depth++
    } else if (upper === ")") {
      if (expectTerm) return false
      depth--
      if (depth < 0) return false
    } else if (upper === "NOT") {
      if (!expectTerm) return false
    } else if (operators.has(upper)) {
      if (expectTerm) return false
      expectTerm = true
      continue
    } else {
      if (!expectTerm) return false
      expectTerm = false
      continue
    }
    if (upper === ")") {
      expectTerm = false
    }
  }

  return depth === 0 && !expectTerm
}

function getTokenAtCursor(
  query: string,
  cursorPos: number
): { token: string; start: number; end: number; context: "tag" | "operator" | "quoted" | "none" } {
  const beforeCursor = query.slice(0, cursorPos)
  const quoteCount = (beforeCursor.match(/"/g) || []).length
  if (quoteCount % 2 === 1) return { token: "", start: cursorPos, end: cursorPos, context: "quoted" }

  let start = cursorPos
  while (start > 0 && !/\s/.test(query[start - 1])) start--
  let end = cursorPos
  while (end < query.length && !/\s/.test(query[end])) end++

  const token = query.slice(start, end)
  if (!token) return { token, start, end, context: "none" }

  const beforeToken = query.slice(0, start).trimEnd()
  if (!beforeToken) return { token, start, end, context: "tag" }

  const prevMatch = beforeToken.match(/(".*?"|[^\s]+)$/)
  if (!prevMatch) return { token, start, end, context: "tag" }

  const lastToken = prevMatch[0].toUpperCase()
  if (["AND", "OR", "NOT", "("].includes(lastToken)) return { token, start, end, context: "tag" }

  return { token, start, end, context: "operator" }
}

const OPERATORS: Array<"AND" | "OR" | "NOT"> = ["AND", "OR", "NOT"]

function computeSuggestions(
  token: string,
  context: "tag" | "operator",
  tags: Tag[]
): SuggestionItem[] {
  const results: SuggestionItem[] = []
  const upper = token.toUpperCase()
  const lower = token.toLowerCase()

  for (const op of OPERATORS) {
    if (op.startsWith(upper)) results.push({ kind: "operator", value: op })
  }

  if (context === "tag") {
    const prefix: SuggestionItem[] = []
    const substr: SuggestionItem[] = []
    for (const tag of tags) {
      const tagLower = tag.name.toLowerCase()
      if (tagLower.startsWith(lower)) {
        prefix.push({ kind: "tag", name: tag.name, matchType: "prefix" })
      } else if (tagLower.includes(lower)) {
        substr.push({ kind: "tag", name: tag.name, matchType: "substring" })
      }
    }
    results.push(...prefix, ...substr)
  }

  return results.slice(0, 8)
}

interface QueryInputProps {
  onDropdownChange: (
    items: SuggestionItem[],
    show: boolean,
    accept: (item: SuggestionItem) => void,
    selectedIndex: number
  ) => void
}

export function QueryInput({ onDropdownChange }: QueryInputProps) {
  const query = useFilterStore((state) => state.query)
  const setQuery = useFilterStore((state) => state.setQuery)
  const executeFilter = useFilterStore((state) => state.executeFilter)
  const tags = useTagStore((state) => state.tags)

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function acceptSuggestion(item: SuggestionItem) {
    const cursorPos = inputRef.current?.selectionStart ?? query.length
    const { start, end } = getTokenAtCursor(query, cursorPos)
    const accepted =
      item.kind === "operator"
        ? item.value
        : item.name.includes(" ")
        ? `"${item.name}"`
        : item.name
    const newQuery = query.slice(0, start) + accepted + " " + query.slice(end)
    setQuery(newQuery)
    setSuggestions([])
    setShowDropdown(false)
    setSelectedIndex(-1)
    onDropdownChange([], false, acceptSuggestion, -1)
    setTimeout(() => {
      if (inputRef.current) {
        const pos = start + accepted.length + 1
        inputRef.current.setSelectionRange(pos, pos)
        inputRef.current.focus()
      }
    }, 0)
  }

  function closeDropdown() {
    setSuggestions([])
    setShowDropdown(false)
    setSelectedIndex(-1)
    onDropdownChange([], false, acceptSuggestion, -1)
  }

  function updateSuggestions(value: string, cursorPos: number) {
    const { token, context } = getTokenAtCursor(value, cursorPos)
    if (context === "quoted" || context === "none" || !token) {
      closeDropdown()
      return
    }
    const items = computeSuggestions(token, context, tags)
    setSuggestions(items)
    const show = items.length > 0
    setShowDropdown(show)
    setSelectedIndex(-1)
    onDropdownChange(items, show, acceptSuggestion, -1)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)
    updateSuggestions(value, e.target.selectionStart ?? value.length)
  }

  function handleClick(e: React.MouseEvent<HTMLInputElement>) {
    const input = e.currentTarget
    updateSuggestions(input.value, input.selectionStart ?? input.value.length)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        const newIdx = (selectedIndex + 1) % suggestions.length
        setSelectedIndex(newIdx)
        onDropdownChange(suggestions, showDropdown, acceptSuggestion, newIdx)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        const newIdx = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1
        setSelectedIndex(newIdx)
        onDropdownChange(suggestions, showDropdown, acceptSuggestion, newIdx)
        return
      }
      if (e.key === "Tab") {
        e.preventDefault()
        acceptSuggestion(suggestions[selectedIndex >= 0 ? selectedIndex : 0])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeDropdown()
        return
      }
      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault()
        acceptSuggestion(suggestions[selectedIndex])
        return
      }
    }
    if (e.key === "Enter") executeFilter()
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => {
      closeDropdown()
    }, 150)
  }

  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current)
  }

  const isValid = useMemo(() => validateQuery(query), [query])
  const showIndicator = query.trim().length > 0

  return (
    <div className="relative flex-1 flex items-center min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onClick={handleClick}
        placeholder="slow AND (rock OR anime) NOT sad"
        className="aurora-focus w-full bg-transparent border-0 pl-4 pr-9 py-2.5 text-[14px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic placeholder:text-[13px]"
        style={{ fontFamily: "var(--font-mono)" }}
      />
      {showIndicator && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {isValid ? (
            <Check className="h-3.5 w-3.5 text-[var(--aurora-accent-interactive)]" strokeWidth={2.5} />
          ) : (
            <X className="h-3.5 w-3.5 text-[var(--aurora-danger)]" strokeWidth={2.5} />
          )}
        </span>
      )}
    </div>
  )
}
