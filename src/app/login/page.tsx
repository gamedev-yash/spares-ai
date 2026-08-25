"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import { login, setAuthCookie } from "@/lib/api/auth"

const DEMO_ACCOUNTS = [
  { code: "DEMO001", role: "End User" },
  { code: "DEMO002", role: "Engineering Manager" },
  { code: "DEMO003", role: "Commercial Manager" },
  { code: "DEMO004", role: "Warehouse Supervisor" },
  { code: "DEMO005", role: "Procurement Officer" },
  { code: "DEMO006", role: "System Admin" },
]

export default function LoginPage() {
  const router = useRouter()
  const [employeeCode, setEmployeeCode] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await login(employeeCode.trim(), password)
      setAuthCookie(result.access_token)
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Spares AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vedanta procurement platform — sign in to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="employee_code" className="text-xs font-medium text-foreground">
              Employee code
            </label>
            <Input
              id="employee_code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. DEMO001"
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-1 h-9">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Demo accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This demo build has no authentication — any password works for a known employee code.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.code}>
                <span className="font-medium text-foreground">{a.code}</span> — {a.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
