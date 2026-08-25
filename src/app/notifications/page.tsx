import type { Metadata } from "next"

import { NotificationList } from "@/components/notifications/notification-list"

export const metadata: Metadata = {
  title: "Notifications — Spares AI",
}

export default function NotificationsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            In-app notifications for approval requests, results, and PO creation.
          </p>
        </div>
        <NotificationList />
      </div>
    </div>
  )
}
