import { apiFetch } from "@/lib/api/client"

export interface AuthUser {
  id: number
  employee_code: string
  name: string
  email: string
  department: string
  role: string
  plant: string
  active: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export function login(employeeCode: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    json: { employee_code: employeeCode, password },
  })
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me")
}

export const AUTH_COOKIE_NAME = "spares_ai_token"
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12 // matches backend JWT_ACCESS_TOKEN_EXPIRE_MINUTES default

export function setAuthCookie(token: string) {
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax`
}

export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}
