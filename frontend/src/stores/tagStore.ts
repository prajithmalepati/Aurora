import { create } from "zustand"
import { api } from "@/lib/api"
import type { Tag, ApiResponse } from "@/types"
import { toast } from "sonner"

interface TagState {
  tags: Tag[]
  loading: boolean

  fetchTags: () => Promise<void>
  deleteTag: (id: number) => Promise<void>
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true })
    try {
      const res = await api.get<ApiResponse<Tag[]>>("/tags")
      set({ tags: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  deleteTag: async (id) => {
    try {
      await api.delete(`/tags/${id}`)
      await get().fetchTags()
      toast.success("Tag deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete tag")
      throw e
    }
  },
}))