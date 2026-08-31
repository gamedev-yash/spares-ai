import { InventoryProvider } from "@/lib/inventory/context"

/**
 * Scoped to /inventory/* only -- Initiative 7 is a client-side mockup that loads its own
 * static CSVs (see /public/data/*.csv) and never touches the FastAPI backend the rest of
 * this app uses, so its data provider has no reason to run on every other route. The
 * --i7-* color variables it needs (theme.css) are loaded globally from the root layout
 * instead, since the sidebar also uses them for its Initiative-7 nav highlight on every page.
 */
export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <InventoryProvider>{children}</InventoryProvider>
}
