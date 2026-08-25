import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const AUTH_COOKIE = "spares_ai_token"
const PUBLIC_PATHS = ["/login"]

// Next.js 16 renamed `middleware` to `proxy` -- see AGENTS.md. This only *redirects*
// based on cookie presence; the backend is the actual authority (every API route
// validates the JWT independently), so this is a UX convenience, not the security boundary.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = Boolean(request.cookies.get(AUTH_COOKIE)?.value)
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  if (!hasToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (hasToken && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
