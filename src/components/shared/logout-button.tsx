"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

import { clearAuthCookie } from "@/lib/api/auth"

export function LogoutButton() {
  const router = useRouter()

  function handleLogout() {
    clearAuthCookie()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted"
    >
      <LogOut className="size-4 shrink-0" />
      Log out
    </button>
  )
}
