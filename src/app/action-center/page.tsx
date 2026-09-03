import type { Metadata } from "next"

import { ActionCenterPage } from "@/components/action-center/action-center-page"

export const metadata: Metadata = {
  title: "Action Center — Vedanta Spares AI",
}

export default function Page() {
  return <ActionCenterPage />
}
