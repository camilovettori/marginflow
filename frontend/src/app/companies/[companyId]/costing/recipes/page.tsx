"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react"
import ConfirmDialog from "@/components/confirm-dialog"
import CostingWorkspacePage from "@/components/costing-workspace-page"
import {
  deleteRecipe,
  duplicateRecipe,
  getCompanyRecipes,
  type RecipeListResponse,
  type RecipeSummary,
} from "@/services/api"

function fmtMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function fmtPercent(value: number | null | undefined) {
  if (value == null) return "-"
  return `${value.toFixed(1)}%`
}

function foodCostClass(value: number | null | undefined) {
  if (value == null) return "text-zinc-400"
  if (value < 30) return "font-semibold text-emerald-700"
  if (value <= 40) return "font-semibold text-amber-700"
  return "font-semibold text-rose-700"
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        Active
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
      Inactive
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-zinc-100" />
        </td>
      ))}
    </tr>
  )
}

type RecipeFilter = "all" | "active" | "missing"

export default function RecipesPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [data, setData] = useState<RecipeListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RecipeFilter>("all")
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<RecipeSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [duplicateBusyId, setDuplicateBusyId] = useState<string | null>(null)

  async function loadRecipes() {
    try {
      setLoading(true)
      setError(null)
      const response = await getCompanyRecipes(companyId)
      setData(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load recipes."
      if (
        message.toLowerCase().includes("session expired") ||
        message.toLowerCase().includes("401") ||
        message.toLowerCase().includes("missing bearer token") ||
        message.toLowerCase().includes("invalid token")
      ) {
        router.replace("/login")
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function handleDeleteRecipe() {
    if (!deleteTarget) return
    try {
      setDeleteBusy(true)
      await deleteRecipe(deleteTarget.id)
      setDeleteTarget(null)
      await loadRecipes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recipe.")
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleDuplicateRecipe(recipe: RecipeSummary) {
    try {
      setDuplicateBusyId(recipe.id)
      const response = await duplicateRecipe(recipe.id, {})
      router.push(`/companies/${companyId}/costing/recipes/${response.recipe.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate recipe.")
    } finally {
      setDuplicateBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const all = data?.recipes ?? []
    return all.filter((r) => {
      if (filter === "active" && !r.is_active) return false
      if (filter === "missing" && !r.has_missing_costs) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return r.recipe_name.toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q)
      }
      return true
    })
  }, [data, filter, search])

  const filterOptions: { label: string; value: RecipeFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Missing costs", value: "missing" },
  ]

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Recipes"
      subtitle="Recipe costing sheets that pull live ingredient prices and calculate food cost."
      actions={
        <Link
          href={`/companies/${companyId}/costing/recipes/new`}
          className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus size={16} />
          New recipe
        </Link>
      }
    >
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {filterOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  filter === f.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                {f.label}
                {f.value === "missing" && (data?.missing_cost_recipes ?? 0) > 0 ? (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    {data?.missing_cost_recipes}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <Search size={14} className="shrink-0 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-44 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Recipe
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Yield
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Cost ex VAT
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Cost per yield
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Food cost %
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filtered.length > 0 ? (
                filtered.map((recipe: RecipeSummary) => (
                  <tr
                    key={recipe.id}
                    className="border-t border-zinc-100 transition hover:bg-zinc-50"
                  >
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/companies/${companyId}/costing/recipes/${recipe.id}`}
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        {recipe.recipe_name}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {recipe.category || "Uncategorised"} · {recipe.ingredient_count} ingredients
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600">
                      {recipe.yield_quantity} {recipe.yield_unit}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-700">
                      {recipe.total_recipe_cost_ex_vat == null
                        ? "-"
                        : fmtMoney(recipe.total_recipe_cost_ex_vat)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-700">
                      {recipe.cost_per_yield_ex_vat == null
                        ? "-"
                        : fmtMoney(recipe.cost_per_yield_ex_vat)}
                    </td>
                    <td className={`px-4 py-3.5 text-right ${foodCostClass(recipe.food_cost_percent)}`}>
                      {fmtPercent(recipe.food_cost_percent)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge active={recipe.is_active} />
                        {recipe.has_missing_costs ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                            Missing cost
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/companies/${companyId}/costing/recipes/${recipe.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                        >
                          <Pencil size={12} />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDuplicateRecipe(recipe)}
                          disabled={duplicateBusyId === recipe.id}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-60"
                        >
                          <Copy size={12} />
                          {duplicateBusyId === recipe.id ? "Duplicating..." : "Duplicate"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(recipe)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-zinc-500">
                    {data?.recipes.length === 0 ? (
                      <span>
                        No recipes yet.{" "}
                        <Link
                          href={`/companies/${companyId}/costing/recipes/new`}
                          className="font-medium text-zinc-950 underline underline-offset-2"
                        >
                          Create your first recipe →
                        </Link>
                      </span>
                    ) : (
                      "No recipes match the current filter."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && data && data.recipes.length > 0 ? (
          <div className="border-t border-zinc-100 px-6 py-3 text-xs text-zinc-500">
            {filtered.length} recipe{filtered.length === 1 ? "" : "s"}
            {filter !== "all" ? ` · ${filter}` : ""}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete recipe?"
        description={
          deleteTarget
            ? `Deleting ${deleteTarget.recipe_name} will remove the recipe and its ingredient lines. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete recipe"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRecipe}
      />
    </CostingWorkspacePage>
  )
}
