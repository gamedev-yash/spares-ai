"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { ALL_FILTER, MaterialSearch } from "@/components/materials/material-search"
import { MaterialTable } from "@/components/materials/material-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import { getMaterialCategories, searchMaterials } from "@/lib/api/materials"
import type { LifecycleStatus, Material } from "@/lib/types"

const PAGE_SIZE = 25

export function MaterialsExplorer() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get("category")
  // `?q=` lets other pages link straight to a material -- the repair register and the
  // declaration log both link here by material code.
  const queryParam = searchParams.get("q")

  const [query, setQuery] = useState(queryParam ?? "")
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam ?? "")
  const [category, setCategory] = useState<string>(ALL_FILTER)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [lifecycle, setLifecycle] = useState<LifecycleStatus | typeof ALL_FILTER>(ALL_FILTER)
  const [page, setPage] = useState(1)

  const [materials, setMaterials] = useState<Material[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMaterialCategories()
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]))
  }, [])

  useEffect(() => {
    if (categoryParam && categoryOptions.includes(categoryParam)) {
      setCategory(categoryParam)
    }
  }, [categoryParam, categoryOptions])

  // Arriving from another page with a new ?q= while already mounted here.
  useEffect(() => {
    if (queryParam) setQuery(queryParam)
  }, [queryParam])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category, lifecycle])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchMaterials({
        q: debouncedQuery || undefined,
        material_group: category === ALL_FILTER ? undefined : category,
        lifecycle_status: lifecycle === ALL_FILTER ? undefined : lifecycle,
        page,
        page_size: PAGE_SIZE,
      })
      setMaterials(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load materials.")
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, category, lifecycle, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  return (
    <div className="flex flex-col gap-4">
      <MaterialSearch
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        categoryOptions={categoryOptions}
        lifecycle={lifecycle}
        onLifecycleChange={setLifecycle}
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${total} material${total === 1 ? "" : "s"} found`}
          </p>
          {loading ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : (
            <MaterialTable materials={materials} />
          )}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
