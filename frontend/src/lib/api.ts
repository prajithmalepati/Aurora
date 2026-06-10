export function getBaseUrl(): string {
  if (typeof window !== "undefined" && (window as any).__AURORA_BASE_URL__) {
    return (window as any).__AURORA_BASE_URL__ as string
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string
  }
  return "http://localhost:8000"
}

const BASE_URL = `${getBaseUrl()}/api`

export { BASE_URL }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    })
  } catch {
    throw new ApiError("Cannot reach server — check that the backend is running", 0)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new ApiError(err.detail || res.statusText, res.status)
  }
  return res.json()
}

// Multipart upload — lets the browser set Content-Type with the boundary
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: "PUT", body: formData })
  } catch {
    throw new ApiError("Cannot reach server — check that the backend is running", 0)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new ApiError(err.detail || res.statusText, res.status)
  }
  return res.json()
}

// POST multipart upload — for file imports (the existing upload helper uses PUT)
async function postUploadRequest<T>(path: string, formData: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: "POST", body: formData })
  } catch {
    throw new ApiError("Cannot reach server — check that the backend is running", 0)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new ApiError(err.detail || res.statusText, res.status)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
  postUpload: <T>(path: string, formData: FormData) => postUploadRequest<T>(path, formData),
}