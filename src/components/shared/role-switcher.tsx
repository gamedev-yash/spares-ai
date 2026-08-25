import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DemoRole } from "@/lib/types"

export function RoleSwitcher({
  roles,
  active,
  onChange,
}: {
  roles: DemoRole[]
  active: DemoRole
  onChange: (role: DemoRole) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Select
        value={active}
        onValueChange={(value) => onChange(value as DemoRole)}
      >
        <SelectTrigger className="h-9 w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground italic">
        Demonstration only — not access control.
      </p>
    </div>
  )
}
