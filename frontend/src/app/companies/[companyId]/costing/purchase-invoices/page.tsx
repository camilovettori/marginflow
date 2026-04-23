"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  createCompanyPurchaseInvoice,
  getCompanyPurchaseInvoices,
  type PurchaseInvoice,
  type PurchaseInvoiceCreatePayload,
  type PurchaseInvoiceLinePayload,
  type PurchaseInvoiceListResponse,
} from "@/services/api"
import CostingWorkspacePage from "@/components/costing-workspace-page"
import { Calculator, FileText, Plus, Save, Trash2 } from "lucide-react"

type InvoiceLineDraft = PurchaseInvoiceLinePayload

function createEmptyLine(): InvoiceLineDraft {
  return {
    ingredient_name: "",
    ingredient_sku: "",
    category: "",
    quantity_purchased: 1,
    purchase_unit: "kg",
    pack_size_value: undefined,
    pack_size_unit: "",
    net_quantity_for_costing: 1000,
    costing_unit: "g",
    line_total_ex_vat: 0,
    vat_rate: 0,
    line_total_inc_vat: 0,
    brand: "",
    supplier_product_name: "",
  }
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function fmtUnitCost(value: number, unit: string) {
  const absoluteValue = Math.abs(value ?? 0)
  const fractionDigits = absoluteValue > 0 && absoluteValue < 0.01 ? 6 : 2

  return `${new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value ?? 0)} / ${unit}`
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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function round6(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function PurchaseInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [data, setData] = useState<PurchaseInvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [supplierName, setSupplierName] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [notes, setNotes] = useState("")
  const [attachmentName, setAttachmentName] = useState("")
  const [vatIncluded, setVatIncluded] = useState(false)
  const [status, setStatus] = useState<"draft" | "posted">("posted")
  const [lines, setLines] = useState<InvoiceLineDraft[]>([createEmptyLine()])

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

  const computedLines = useMemo(
    () =>
      lines.map((line) => {
        const exVat = Number(line.line_total_ex_vat || 0)
        const vatRate = Number(line.vat_rate || 0)
        const incVat = round2(exVat * (1 + vatRate / 100))
        const netQty = Number(line.net_quantity_for_costing || 0)
        const normalizedEx = netQty > 0 ? round6(exVat / netQty) : 0
        const normalizedInc = netQty > 0 ? round6(incVat / netQty) : 0
        return {
          ...line,
          line_total_inc_vat: incVat,
          normalized_ex_vat: normalizedEx,
          normalized_inc_vat: normalizedInc,
          vat_amount: round2(incVat - exVat),
        }
      }),
    [lines]
  )

  const totals = useMemo(() => {
    const subtotal = round2(computedLines.reduce((sum, line) => sum + (line.line_total_ex_vat || 0), 0))
    const vatTotal = round2(computedLines.reduce((sum, line) => sum + line.vat_amount, 0))
    const totalInc = round2(computedLines.reduce((sum, line) => sum + (line.line_total_inc_vat || 0), 0))
    return { subtotal, vatTotal, totalInc }
  }, [computedLines])

  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    )
  }

  function addLine() {
    setLines((current) => [...current, createEmptyLine()])
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)))
  }

  function resetForm() {
    setSupplierName("")
    setInvoiceNumber("")
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setDueDate("")
    setCurrency("EUR")
    setNotes("")
    setAttachmentName("")
    setVatIncluded(false)
    setStatus("posted")
    setLines([createEmptyLine()])
  }

  async function handleCreateInvoice() {
    try {
      if (!supplierName.trim()) throw new Error("Supplier name is required.")
      if (!invoiceNumber.trim()) throw new Error("Invoice number is required.")
      if (!invoiceDate.trim()) throw new Error("Invoice date is required.")
      if (computedLines.some((line) => !line.ingredient_name.trim())) {
        throw new Error("Each invoice line needs an ingredient name.")
      }
      if (computedLines.some((line) => Number(line.net_quantity_for_costing || 0) <= 0)) {
        throw new Error("Each invoice line needs a net quantity for costing greater than zero.")
      }

      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const payload: PurchaseInvoiceCreatePayload = {
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate.trim() || null,
        currency: currency.trim().toUpperCase(),
        notes: notes.trim() || null,
        attachment_name: attachmentName.trim() || null,
        vat_included: vatIncluded,
        subtotal_ex_vat: totals.subtotal,
        vat_total: totals.vatTotal,
        total_inc_vat: totals.totalInc,
        status,
        lines: computedLines.map((line) => ({
          ingredient_name: line.ingredient_name.trim(),
          ingredient_sku: line.ingredient_sku?.trim() || null,
          category: line.category?.trim() || null,
          quantity_purchased: Number(line.quantity_purchased || 0),
          purchase_unit: line.purchase_unit.trim().toLowerCase(),
          pack_size_value: line.pack_size_value ? Number(line.pack_size_value) : null,
          pack_size_unit: line.pack_size_unit?.trim().toLowerCase() || null,
          net_quantity_for_costing: Number(line.net_quantity_for_costing || 0),
          costing_unit: line.costing_unit.trim().toLowerCase(),
          line_total_ex_vat: Number(line.line_total_ex_vat || 0),
          vat_rate: Number(line.vat_rate || 0),
          line_total_inc_vat: Number(line.line_total_inc_vat || 0),
          brand: line.brand?.trim() || null,
          supplier_product_name: line.supplier_product_name?.trim() || null,
        })),
      }

      const created = await createCompanyPurchaseInvoice(companyId, payload)
      setSuccessMessage(
        `Invoice ${created.invoice_number} saved with ${created.lines.length} line${created.lines.length === 1 ? "" : "s"} and ${created.status === "posted" ? "ingredient prices refreshed." : "draft status retained."}`
      )
      resetForm()
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save purchase invoice.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Purchase Invoices"
      subtitle="Register supplier invoices for ingredients, production inputs, and packaging so the costing engine can calculate normalized live costs."
      companyMeta="Posted invoices update ingredient latest paid price automatically. Drafts stay in the register without changing live costing."
      actions={
        <button
          onClick={handleCreateInvoice}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save invoice"}
        </button>
      }
    >
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-700 shadow-sm">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-zinc-900 p-3 text-white">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Invoice header</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  Capture supplier purchase headers and costing lines
                </h2>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Supplier name" value={supplierName} onChange={setSupplierName} placeholder="Musgraves, bakery supplier, roastery..." />
              <Field label="Invoice number" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="INV-2026-041" />
              <Field label="Invoice date" type="date" value={invoiceDate} onChange={setInvoiceDate} />
              <Field label="Due date" type="date" value={dueDate} onChange={setDueDate} />
              <SelectField
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" },
                  { value: "USD", label: "USD" },
                ]}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={(value) => setStatus(value as "draft" | "posted")}
                options={[
                  { value: "posted", label: "Posted" },
                  { value: "draft", label: "Draft" },
                ]}
              />
              <Field label="Attachment placeholder" value={attachmentName} onChange={setAttachmentName} placeholder="invoice-apr-23.pdf" />
              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={vatIncluded}
                    onChange={(event) => setVatIncluded(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  VAT included on supplier document
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-zinc-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Delivery notes, quality flags, supplier comments..."
                  className="min-h-[120px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Invoice lines</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">Normalize each ingredient purchase</h2>
              </div>
              <button
                onClick={addLine}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                <Plus size={16} />
                Add line
              </button>
            </div>

            <div className="space-y-4 p-5">
              {computedLines.map((line, index) => (
                <div key={index} className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-zinc-950">Line {index + 1}</p>
                    <button
                      onClick={() => removeLine(index)}
                      disabled={computedLines.length === 1}
                      className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field
                      label="Ingredient name"
                      value={line.ingredient_name}
                      onChange={(value) => updateLine(index, { ingredient_name: value })}
                      placeholder="Strong flour, butter, coffee beans..."
                    />
                    <Field
                      label="Supplier product name"
                      value={line.supplier_product_name ?? ""}
                      onChange={(value) => updateLine(index, { supplier_product_name: value })}
                      placeholder="Supplier line description"
                    />
                    <Field
                      label="Ingredient SKU"
                      value={line.ingredient_sku ?? ""}
                      onChange={(value) => updateLine(index, { ingredient_sku: value })}
                      placeholder="Optional SKU"
                    />
                    <Field
                      label="Category"
                      value={line.category ?? ""}
                      onChange={(value) => updateLine(index, { category: value })}
                      placeholder="Flour, dairy, coffee..."
                    />
                    <Field
                      label="Quantity purchased"
                      type="number"
                      value={String(line.quantity_purchased)}
                      onChange={(value) => updateLine(index, { quantity_purchased: Number(value || 0) })}
                    />
                    <SelectField
                      label="Purchase unit"
                      value={line.purchase_unit}
                      onChange={(value) => updateLine(index, { purchase_unit: value })}
                      options={[
                        { value: "kg", label: "kg" },
                        { value: "g", label: "g" },
                        { value: "l", label: "l" },
                        { value: "ml", label: "ml" },
                        { value: "unit", label: "unit" },
                        { value: "pack", label: "pack" },
                        { value: "box", label: "box" },
                      ]}
                    />
                    <Field
                      label="Pack size value"
                      type="number"
                      value={line.pack_size_value != null ? String(line.pack_size_value) : ""}
                      onChange={(value) => updateLine(index, { pack_size_value: value ? Number(value) : undefined })}
                      placeholder="Optional"
                    />
                    <SelectField
                      label="Pack size unit"
                      value={line.pack_size_unit ?? ""}
                      onChange={(value) => updateLine(index, { pack_size_unit: value })}
                      options={[
                        { value: "", label: "Optional" },
                        { value: "kg", label: "kg" },
                        { value: "g", label: "g" },
                        { value: "l", label: "l" },
                        { value: "ml", label: "ml" },
                        { value: "unit", label: "unit" },
                      ]}
                    />
                    <Field
                      label="Net quantity for costing"
                      type="number"
                      value={String(line.net_quantity_for_costing)}
                      onChange={(value) => updateLine(index, { net_quantity_for_costing: Number(value || 0) })}
                    />
                    <SelectField
                      label="Costing unit"
                      value={line.costing_unit}
                      onChange={(value) => updateLine(index, { costing_unit: value })}
                      options={[
                        { value: "g", label: "g" },
                        { value: "ml", label: "ml" },
                        { value: "unit", label: "unit" },
                      ]}
                    />
                    <Field
                      label="Line total ex VAT"
                      type="number"
                      value={String(line.line_total_ex_vat)}
                      onChange={(value) => updateLine(index, { line_total_ex_vat: Number(value || 0) })}
                    />
                    <Field
                      label="VAT rate %"
                      type="number"
                      value={String(line.vat_rate)}
                      onChange={(value) => updateLine(index, { vat_rate: Number(value || 0) })}
                    />
                    <Field
                      label="Brand"
                      value={line.brand ?? ""}
                      onChange={(value) => updateLine(index, { brand: value })}
                      placeholder="Optional brand"
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Line inc VAT</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-950">{fmtMoney(line.line_total_inc_vat ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Normalized ex VAT</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-950">
                        {fmtUnitCost(line.normalized_ex_vat, line.costing_unit)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Normalized inc VAT</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-950">
                        {fmtUnitCost(line.normalized_inc_vat, line.costing_unit)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <Calculator size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Live totals</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">Invoice costing summary</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium text-zinc-500">Subtotal ex VAT</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{fmtMoney(totals.subtotal)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium text-zinc-500">VAT total</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{fmtMoney(totals.vatTotal)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium text-zinc-500">Total inc VAT</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{fmtMoney(totals.totalInc)}</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Posted invoices update the latest ingredient price memory. Drafts stay visible in the register without moving live costing.
            </p>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-zinc-100 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Invoice register</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">Recent purchase invoices</h2>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-zinc-500">Loading purchase invoices...</div>
            ) : data && data.invoices.length > 0 ? (
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <p className="text-sm font-medium text-zinc-500">Invoices tracked</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">{data.total_invoices}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <p className="text-sm font-medium text-zinc-500">Total spend ex VAT</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtMoney(data.total_spend_ex_vat)}</p>
                  </div>
                </div>

                {data.invoices.map((invoice: PurchaseInvoice) => (
                  <div key={invoice.id} className="rounded-[24px] border border-zinc-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{invoice.supplier_name}</p>
                        <h3 className="mt-2 text-lg font-semibold text-zinc-950">{invoice.invoice_number}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatDate(invoice.invoice_date)} - {invoice.lines.length} line{invoice.lines.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          invoice.status === "posted"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-sm font-medium text-zinc-500">Subtotal ex VAT</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-950">{fmtMoney(invoice.subtotal_ex_vat)}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-sm font-medium text-zinc-500">VAT total</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-950">{fmtMoney(invoice.vat_total)}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <p className="text-sm font-medium text-zinc-500">Total inc VAT</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-950">{fmtMoney(invoice.total_inc_vat)}</p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50 text-left text-zinc-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Ingredient</th>
                            <th className="px-4 py-3 font-medium text-right">Net qty</th>
                            <th className="px-4 py-3 font-medium">Costing unit</th>
                            <th className="px-4 py-3 font-medium text-right">Ex VAT</th>
                            <th className="px-4 py-3 font-medium text-right">Normalized</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.lines.map((line) => (
                            <tr key={line.id} className="border-t border-zinc-100">
                              <td className="px-4 py-3 text-zinc-900">{line.ingredient_name}</td>
                              <td className="px-4 py-3 text-right text-zinc-700">{line.net_quantity_for_costing}</td>
                              <td className="px-4 py-3 text-zinc-700">{line.costing_unit}</td>
                              <td className="px-4 py-3 text-right text-zinc-700">{fmtMoney(line.line_total_ex_vat)}</td>
                              <td className="px-4 py-3 text-right text-zinc-700">
                                {fmtUnitCost(line.normalized_unit_cost_ex_vat, line.costing_unit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">
                No purchase invoices captured yet. Save the first supplier invoice to start ingredient price tracking.
              </div>
            )}
          </div>
        </div>
      </div>
    </CostingWorkspacePage>
  )
}
