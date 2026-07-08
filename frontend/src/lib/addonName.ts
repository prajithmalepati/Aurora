import type { Addon } from "@/types"

/**
 * Resolve an addon source string (e.g. "addon:spotify") to a display name.
 * Falls back to the raw addon ID if no matching addon is found.
 * Pass the addons array from useAddonStore — keeps this a pure function.
 */
export function addonName(source: string, addons: Addon[]): string {
  const addonId = source.replace("addon:", "")
  return addons.find((a) => a.id === addonId)?.name ?? addonId
}
