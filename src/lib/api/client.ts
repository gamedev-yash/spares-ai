// Base fetch wrapper for the FastAPI backend. Centralizes the base URL, auth header
// injection, and error normalization so components never call `fetch` directly.
//
// - Server Components / Route Handlers: use `BACKEND_INTERNAL_URL` when set (Docker
//   Compose service-to-service networking), falling back to the public URL.
// - Client Components: always use `NEXT_PUBLIC_API_BASE_URL` (browser-reachable).

export class ApiError extends Error {
  status: number
  code: string
  details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

function baseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"
}

const AUTH_COOKIE = "spares_ai_token"

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    // Server Components / Route Handlers: read the incoming request's cookie.
    try {
      const { cookies } = await import("next/headers")
      const store = await cookies()
      return store.get(AUTH_COOKIE)?.value ?? null
    } catch {
      return null
    }
  }
  const match = document.cookie.match(/(?:^|;\s*)spares_ai_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  params?: Record<string, string | number | boolean | undefined | null>
  json?: unknown
  token?: string
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { params, json, token, headers, ...rest } = options

  const url = new URL(`${baseUrl()}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const authToken = token ?? (await getAuthToken())

  const response = await fetch(url.toString(), {
    ...rest,
    cache: "no-store",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  })

  if (!response.ok) {
    let code = "http_error"
    let message = response.statusText
    let details: unknown = null
    try {
      const payload = await response.json()
      code = payload?.error?.code ?? code
      message = payload?.error?.message ?? message
      details = payload?.error?.details ?? null
    } catch {
      // response body wasn't JSON -- fall back to statusText above
    }
    throw new ApiError(response.status, code, message, details)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
