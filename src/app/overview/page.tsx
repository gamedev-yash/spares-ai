import type { Metadata } from "next"

import { SparesControlTower } from "@/components/overview/spares-control-tower"

export const metadata: Metadata = {
  title: "Spares Control Tower — Vedanta Spares AI",
}

export default function Page() {
  return <SparesControlTower />
}
