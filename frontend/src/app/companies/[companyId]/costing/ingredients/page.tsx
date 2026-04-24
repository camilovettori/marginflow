"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  archiveIngredient,
  getCompanyIngredients,
  getIngredientDetail,
  updateIngredient,
  type Ingredient,
  type IngredientDetailResponse,
  type IngredientListResponse,
} from "@/services/api"
import CostingWorkspacePage from "@/components/costing-workspace-page"
import ConfirmDialog from "@/components/confirm-dialog"
import { ArrowRight, Save, Search } from "lucide-react"

function fmtMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function fmtUnitCost(value: number | null | undefined, unit: string) {
  const abs = Math.abs(value ?? 0)
  const fractionDigits = abs > 0 && abs < 0.01 ? 6 : 2
  return `${new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value ?? 0)} / ${unit}`
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
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

function MissingBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
      No price
    </span>
  )
}

type ViewFilter = "all" | "active" | "inactive" | "missing"

export default function IngredientsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [data, setData] = useState<IngredientListResponse | null>(null)
  const [detail, setDetail] = useState<IngredientDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"all" | "active" | "inactive">("all")
  const [missingFilter, setMissingFilter] = useState(false)
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUnit, setEditUnit] = useState("g")
  const [editCategory, setEditCategory] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)

  const activeViewFilter: ViewFilter = missingFilter ? "missing" : view

  async function loadIngredients() {
    try {
      setLoading(true)
      setError(null)
      const response = await getCompanyIngredients(companyId, {
        search: search.trim() || undefined,
        view: missingFilter ? "all" : view,
      })
      setData(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ingredients."
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

  async function loadIngredientDetail(ingredientId: string) {
    try {
      setDetailLoading(true)
      setDetailError(null)
      const response = await getIngredientDetail(ingredientId)
      setDetail(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ingredient."
      setDetailError(message)
    } finally {
      setDetailLoading(false)
    }
  }

  const displayedIngredients = useMemo(() => {
    const all = data?.ingredients ?? []
    if (missingFilter) return all.filter((i) => i.latest_unit_cost_ex_vat == null)
    return all
  }, [data, missingFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadIngredients()
    }, 250)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, companyId, view, missingFilter])

  useEffect(() => {
    if (!displayedIngredients.length) {
      setSelectedIngredientId(null)
      setDetail(null)
      return
    }
    const selectedExists = displayedIngredients.some((i) => i.id === selectedIngredientId)
    if (!selectedIngredientId || !selectedExists) {
      setSelectedIngredientId(displayedIngredients[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, missingFilter])

  useEffect(() => {
    if (selectedIngredientId) {
      void loadIngredientDetail(selectedIngredientId)
    } else {
      setDetail(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredientId])

  useEffect(() => {
    const ingredient = detail?.ingredient
    if (!ingredient) return
    setEditName(ingredient.name)
    setEditUnit(ingredient.default_unit_for_costing)
    setEditCategory(ingredient.category ?? "")
    setEditNotes(ingredient.notes ?? "")
    setEditActive(ingredient.is_active)
  }, [detail])

  const summary = useMemo(
    () => ({
      totalIngredients: data?.total_ingredients ?? 0,
      activeIngredients: data?.active_ingredients ?? 0,
      missingPrices: data?.missing_price_ingredients ?? 0,
    }),
    [data]
  )

  async function handleSaveIngredient() {
    if (!detail?.ingredient) return
    try {
      setSaving(true)
      setError(null)
      setDetailError(null)
      setSuccessMessage(null)
      const updated = await updateIngredient(detail.ingredient.id, {
        name: editName.trim(),
        default_unit_for_costing: editUnit.trim().toLowerCase(),
        category: editCategory.trim() || null,
        notes: editNotes.trim() || null,
        is_active: editActive,
      })
      setSuccessMessage(`${updated.name} saved.`)
      await loadIngredients()
      await loadIngredientDetail(updated.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ingredient.")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveIngredient() {
    if (!detail?.ingredient) return
    try {
      setArchiveBusy(true)
      setError(null)
      setDetailError(null)
      setSuccessMessage(null)
      const archived = await archiveIngredient(detail.ingredient.id)
      setSuccessMessage(`${archived.name} archived.`)
      await loadIngredients()
      await loadIngredientDetail(archived.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive ingredient.")
    } finally {
      setArchiveBusy(false)
    }
  }

  const selectedIngredient = detail?.ingredient ?? null

  const filterOptions: { label: string; value: ViewFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Missing price", value: "missing" },
  ]

  function handleFilterClick(value: ViewFilter) {
    if (value === "missing") {
      setMissingFilter(true)
      setView("all")
    } else {
      setMissingFilter(false)
      setView(value)
    }
  }

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Ingredients"
      subtitle="Supplier-priced ingredient catalog. Latest price is driven by purchase history."
    >
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 shadow-sm">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Left: list */}
        <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="border-b border-zinc-100 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => handleFilterClick(f.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      activeViewFilter === f.value
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                    }`}
                  >
                    {f.label}
                    {f.value === "missing" && summary.missingPrices > 0 ? (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        {summary.missingPrices}
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
                  placeholder="Search ingredients..."
                  className="w-44 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />
              ))}
            </div>
          ) : displayedIngredients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Ingredient
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Latest ex VAT
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Latest inc VAT
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Last purchase
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedIngredients.map((ingredient: Ingredient) => {
                    const isSelected = ingredient.id === selectedIngredientId
                    const missingPrice = ingredient.latest_unit_cost_ex_vat == null
                    return (
                      <tr
                        key={ingredient.id}
                        onClick={() => setSelectedIngredientId(ingredient.id)}
                        className={`cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50 ${
                          isSelected
                            ? "border-l-2 border-l-zinc-900 bg-zinc-50/80"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-zinc-950">{ingredient.name}</span>
                            <StatusBadge active={ingredient.is_active} />
                            {missingPrice ? <MissingBadge /> : null}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {ingredient.category || "Uncategorised"} · {ingredient.purchase_count} purchases
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600">
                          {ingredient.default_unit_for_costing}
                        </td>
                        <td className="px-4 py-3.5 text-right text-zinc-700">
                          {missingPrice
                            ? "-"
                            : fmtUnitCost(
                                ingredient.latest_unit_cost_ex_vat,
                                ingredient.default_unit_for_costing
                              )}
                        </td>
                        <td className="px-4 py-3.5 text-right text-zinc-700">
                          {missingPrice
                            ? "-"
                            : fmtUnitCost(
                                ingredient.latest_unit_cost_inc_vat,
                                ingredient.default_unit_for_costing
                              )}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600">
                          {ingredient.latest_supplier_name || "-"}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-600">
                          {formatDate(ingredient.latest_purchase_date)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-sm text-zinc-500">
              {data?.ingredients.length === 0
                ? "No ingredients yet. Post a supplier invoice to start building the catalog."
                : "No ingredients match the current filter."}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="space-y-4">
          <div className="sticky top-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {detailLoading ? (
              <div className="space-y-3">
                <div className="h-6 animate-pulse rounded-xl bg-zinc-100" />
                <div className="h-4 w-3/4 animate-pulse rounded-xl bg-zinc-100" />
                <div className="mt-4 h-24 animate-pulse rounded-xl bg-zinc-100" />
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {detailError}
              </div>
            ) : selectedIngredient ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Ingredient detail
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                      {selectedIngredient.name}
                    </h2>
                  </div>
                  <StatusBadge active={selectedIngredient.is_active} />
                </div>

                {/* Price highlight */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                      Latest ex VAT
                    </p>
                    <p className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-950">
                      {selectedIngredient.latest_unit_cost_ex_vat == null
                        ? "-"
                        : fmtUnitCost(
                            selectedIngredient.latest_unit_cost_ex_vat,
                            selectedIngredient.default_unit_for_costing
                          )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                      Latest inc VAT
                    </p>
                    <p className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-950">
                      {selectedIngredient.latest_unit_cost_inc_vat == null
                        ? "-"
                        : fmtUnitCost(
                            selectedIngredient.latest_unit_cost_inc_vat,
                            selectedIngredient.default_unit_for_costing
                          )}
                    </p>
                  </div>
                </div>

                {selectedIngredient.latest_unit_cost_ex_vat == null ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No purchase history yet. Post a supplier invoice to set the live price.
                  </div>
                ) : null}

                {/* Editable fields */}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Ingredient name
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Default costing unit
                    </label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="unit">unit</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Category
                    </label>
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="Dairy, flour, coffee..."
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      Active ingredient
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Stock handling, sourcing context..."
                      className="min-h-[80px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleSaveIngredient}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Save size={15} />
                    {saving ? "Saving..." : "Save ingredient"}
                  </button>
                  <button
                    onClick={() => setArchiveConfirmOpen(true)}
                    disabled={archiveBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    {archiveBusy ? "Archiving..." : "Archive"}
                  </button>
                  <Link
                    href={`/companies/${companyId}/costing/purchase-invoices`}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    View invoices <ArrowRight size={14} />
                  </Link>
                </div>

                {/* Purchase history */}
                {detail?.recent_purchases?.length ? (
                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Purchase history
                    </p>
                    <div className="mt-3 space-y-3">
                      {detail.recent_purchases.map((purchase) => (
                        <div
                          key={purchase.line_id}
                          className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-950">
                                {purchase.supplier_name}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {purchase.invoice_number} · {formatDate(purchase.invoice_date)} ·{" "}
                                {purchase.quantity_purchased} {purchase.purchase_unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-zinc-950">
                                {fmtMoney(purchase.line_total_ex_vat)}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-zinc-500">
                                {fmtUnitCost(
                                  purchase.normalized_unit_cost_ex_vat,
                                  purchase.costing_unit
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-zinc-500">
                  Select an ingredient to view details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="Archive ingredient?"
        description={
          selectedIngredient
            ? `Archiving ${selectedIngredient.name} will hide it from active workflows, but keep invoice and recipe history intact.`
            : ""
        }
        confirmLabel="Archive ingredient"
        destructive
        busy={archiveBusy}
        onCancel={() => setArchiveConfirmOpen(false)}
        onConfirm={async () => {
          setArchiveConfirmOpen(false)
          await handleArchiveIngredient()
        }}
      />
    </CostingWorkspacePage>
  )
}
