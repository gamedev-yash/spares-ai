import { apiFetch } from "@/lib/api/client"
import type { Page } from "@/lib/api/types"
import type { Material } from "@/lib/types"

export interface MaterialSearchParams {
  q?: string
  material_group?: string
  plant?: string
  criticality?: string
  lifecycle_status?: string
  active?: boolean
  sort_by?: "material_code" | "description" | "last_po_price" | "lead_time_days" | "stock_level"
  sort_dir?: "asc" | "desc"
  page?: number
  page_size?: number
  [key: string]: string | number | boolean | undefined
}

export function searchMaterials(params: MaterialSearchParams = {}): Promise<Page<Material>> {
  return apiFetch<Page<Material>>("/materials", { params })
}

export function getMaterial(id: number): Promise<Material> {
  return apiFetch<Material>(`/materials/${id}`)
}

/** Distinct material_group values actually in the generated catalog -- not a static list. */
export function getMaterialCategories(): Promise<string[]> {
  return apiFetch<string[]>("/materials/categories")
}
