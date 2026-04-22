import { useEffect } from "react"
import { toast, useSonner } from "sonner"

// Attaches a document-level click handler that dismisses whichever toast was clicked.
// Sonner exposes data-index on each <li> which maps to the position in the toasts array.
export function ToastClickDismiss() {
  const { toasts } = useSonner()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const toastEl = (e.target as HTMLElement).closest("[data-sonner-toast]") as HTMLElement | null
      if (!toastEl) return
      if ((e.target as HTMLElement).closest("button, a, [data-button], [data-cancel]")) return

      const indexAttr = toastEl.getAttribute("data-index")
      if (indexAttr === null) return
      const index = parseInt(indexAttr, 10)
      if (!isNaN(index) && toasts[index]) {
        toast.dismiss(toasts[index].id)
      }
    }

    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [toasts])

  return null
}
