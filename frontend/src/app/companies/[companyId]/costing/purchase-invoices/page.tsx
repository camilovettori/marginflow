"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  deleteCompanyPurchaseInvoice,
  getCompanyPurchaseInvoices,
  type PurchaseInvoice,
  type PurchaseInvoiceListResponse,
} from "@/services/api"
import ConfirmDialog from "@/components/confirm-dialog"
import CostingWorkspacePage from "@/components/costing-workspace-page"
import InvoiceCreateSlideOver from "@/components/invoice-create-slide-over"
import SlideOver from "@/components/slide-over"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"

function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v ?? 0)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function StatusBadge({ status }: { status: string }) {
  if (status === "posted") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        Posted
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
      Draft
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-zinc-100" />
        </td>
      ))}
    </tr>
  )
}

type FilterStatus = "all" | "draft" | "posted"

export default function PurchaseInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [data, setData] = useState<PurchaseInvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function loadInvoices() {
    try {
      setLoading(true)
      setError(null)
      const response = await getCompanyPurchaseInvoices(companyId)
      setData(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load purchase invoices."
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
    loadInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function handleDeleteInvoice() {
    if (!deleteTarget) return
    try {
      setDeleteBusy(true)
      await deleteCompanyPurchaseInvoice(deleteTarget.id)
      if (selectedInvoice?.id === deleteTarget.id) {
        setSelectedInvoice(null)
      }
      if (editingInvoice?.id === deleteTarget.id) {
        setEditingInvoice(null)
      }
      setDeleteTarget(null)
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice.")
    } finally {
      setDeleteBusy(false)
    }
  }

  const filtered = (data?.invoices ?? []).filter((inv) => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        inv.supplier_name.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q)
      )
    }
    return true
  })

  const filters: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "Draft", value: "draft" },
    { label: "Posted", value: "posted" },
  ]

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Purchase Invoices"
      subtitle="Register supplier invoices so the costing engine can maintain normalized ingredient prices."
      actions={
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus size={16} />
          New invoice
        </button>
      }
    >
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  filterStatus === f.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <Search size={14} className="shrink-0 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier or invoice #..."
              className="w-56 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Supplier
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Lines
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Ex VAT
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                  Inc VAT
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
                  <SkeletonRow />
                </>
              ) : filtered.length > 0 ? (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50"
                  >
                    <td className="px-6 py-3.5 font-medium text-zinc-950">{inv.supplier_name}</td>
                    <td className="px-4 py-3.5 text-zinc-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3.5 text-zinc-600">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3.5 text-right text-zinc-600">{inv.lines.length}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-zinc-950">
                      {fmtMoney(inv.subtotal_ex_vat)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-600">
                      {fmtMoney(inv.total_inc_vat)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingInvoice(inv)
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(inv)
                          }}
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
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-zinc-500">
                    {data?.invoices.length === 0 ? (
                      <span>
                        No invoices yet.{" "}
                        <button
                          onClick={() => setShowCreate(true)}
                          className="font-medium text-zinc-950 underline underline-offset-2"
                        >
                          Add your first invoice
                        </button>
                      </span>
                    ) : (
                      "No invoices match the current filter."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && data && data.invoices.length > 0 ? (
          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3 text-xs text-zinc-500">
            <span>
              {filtered.length} invoice{filtered.length === 1 ? "" : "s"}
              {filterStatus !== "all" ? ` - ${filterStatus}` : ""}
            </span>
            <span>
              Total spend ex VAT:{" "}
              <span className="font-semibold text-zinc-950">
                {fmtMoney(data.total_spend_ex_vat)}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <InvoiceCreateSlideOver
        companyId={companyId}
        open={showCreate || editingInvoice !== null}
        mode={editingInvoice ? "edit" : "create"}
        invoice={editingInvoice}
        onClose={() => {
          setShowCreate(false)
          setEditingInvoice(null)
        }}
        onSaved={async () => {
          setShowCreate(false)
          setEditingInvoice(null)
          setSelectedInvoice(null)
          await loadInvoices()
        }}
      />

      <SlideOver
        open={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        title={
          selectedInvoice ? (
            <span className="flex items-center gap-3">
              <span>{selectedInvoice.invoice_number}</span>
              <StatusBadge status={selectedInvoice.status} />
            </span>
          ) : (
            ""
          )
        }
      >
        {selectedInvoice ? (
          <div>
            <div className="border-b border-zinc-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{selectedInvoice.supplier_name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatDate(selectedInvoice.invoice_date)}
                    {selectedInvoice.due_date ? ` - Due ${formatDate(selectedInvoice.due_date)}` : ""}
                    {selectedInvoice.notes ? ` - ${selectedInvoice.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingInvoice(selectedInvoice)
                      setSelectedInvoice(null)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(selectedInvoice)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                    Ex VAT
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">
                    {fmtMoney(selectedInvoice.subtotal_ex_vat)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                    VAT
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">
                    {fmtMoney(selectedInvoice.vat_total)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                    Inc VAT
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">
                    {fmtMoney(selectedInvoice.total_inc_vat)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pt-5 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Ingredient lines
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Ingredient
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Net qty
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Unit
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      Ex VAT
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      /unit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lines.map((l) => (
                    <tr key={l.id} className="border-t border-zinc-100">
                      <td className="px-6 py-3 font-medium text-zinc-900">{l.ingredient_name}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {l.net_quantity_for_costing}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{l.costing_unit}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {fmtMoney(l.line_total_ex_vat)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">
                        {l.normalized_unit_cost_ex_vat?.toFixed(6) ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </SlideOver>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete invoice?"
        description={
          deleteTarget
            ? `Deleting ${deleteTarget.invoice_number} may change latest ingredient pricing. MarginFlow will recalculate affected ingredient memory.`
            : ""
        }
        confirmLabel="Delete invoice"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteInvoice}
      />
    </CostingWorkspacePage>
  )
}
