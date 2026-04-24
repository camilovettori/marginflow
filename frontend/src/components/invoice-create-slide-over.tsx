"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  createCompanyPurchaseInvoice,
  updateCompanyPurchaseInvoice,
  uploadCompanyPurchaseInvoicePdf,
  type PurchaseInvoice,
  type PdfExtractResponse,
  type PurchaseInvoiceCreatePayload,
  type PurchaseInvoiceLinePayload,
} from "@/services/api"
import SlideOver from "@/components/slide-over"
import { AlertTriangle, Plus, Save, Trash2, Upload, X } from "lucide-react"

type InvoiceLineDraft = PurchaseInvoiceLinePayload & {
  normalized_ex_vat?: number
  normalized_inc_vat?: number
  vat_amount?: number
}

function createEmptyLine(): PurchaseInvoiceLinePayload {
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

function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v ?? 0)
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

function round6(v: number) {
  return Math.round((v + Number.EPSILON) * 1_000_000) / 1_000_000
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  )
}

function FInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
    />
  )
}

function FSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export default function InvoiceCreateSlideOver({
  companyId,
  open,
  mode = "create",
  invoice,
  onClose,
  onSaved,
}: {
  companyId: string
  open: boolean
  mode?: "create" | "edit"
  invoice?: PurchaseInvoice | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [supplierName, setSupplierName] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [notes, setNotes] = useState("")
  const [attachmentName, setAttachmentName] = useState("")
  const [vatIncluded, setVatIncluded] = useState(false)
  const [lines, setLines] = useState<PurchaseInvoiceLinePayload[]>([createEmptyLine()])

  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([])
  const [prefillDone, setPrefillDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditMode = mode === "edit"

  const computedLines = useMemo(
    () =>
      lines.map((line) => {
        const exVat = Number(line.line_total_ex_vat || 0)
        const vatRate = Number(line.vat_rate || 0)
        const incVat = round2(exVat * (1 + vatRate / 100))
        const netQty = Number(line.net_quantity_for_costing || 0)
        return {
          ...line,
          line_total_inc_vat: incVat,
          normalized_ex_vat: netQty > 0 ? round6(exVat / netQty) : 0,
          normalized_inc_vat: netQty > 0 ? round6(incVat / netQty) : 0,
          vat_amount: round2(incVat - exVat),
        } as InvoiceLineDraft
      }),
    [lines]
  )

  const totals = useMemo(
    () => ({
      subtotal: round2(computedLines.reduce((s, l) => s + (l.line_total_ex_vat || 0), 0)),
      vatTotal: round2(computedLines.reduce((s, l) => s + (l.vat_amount ?? 0), 0)),
      totalInc: round2(computedLines.reduce((s, l) => s + (l.line_total_inc_vat || 0), 0)),
    }),
    [computedLines]
  )

  function updateLine(i: number, patch: Partial<PurchaseInvoiceLinePayload>) {
    setLines((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((c) => [...c, createEmptyLine()])
  }

  function removeLine(i: number) {
    setLines((c) => (c.length === 1 ? c : c.filter((_, idx) => idx !== i)))
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
    setLines([createEmptyLine()])
    setExtractionWarnings([])
    setPrefillDone(false)
    setShowUpload(false)
    setSelectedFile(null)
    setError(null)
  }

  function populateFromInvoice(source: PurchaseInvoice) {
    setSupplierName(source.supplier_name)
    setInvoiceNumber(source.invoice_number)
    setInvoiceDate(source.invoice_date)
    setDueDate(source.due_date ?? "")
    setCurrency(source.currency)
    setNotes(source.notes ?? "")
    setAttachmentName(source.attachment_name ?? "")
    setVatIncluded(source.vat_included)
    setLines(
      source.lines.length > 0
        ? source.lines.map((line) => ({
            ingredient_name: line.ingredient_name,
            ingredient_sku: line.ingredient_sku ?? "",
            category: line.category ?? "",
            quantity_purchased: line.quantity_purchased,
            purchase_unit: line.purchase_unit,
            pack_size_value: line.pack_size_value ?? undefined,
            pack_size_unit: line.pack_size_unit ?? "",
            net_quantity_for_costing: line.net_quantity_for_costing,
            costing_unit: line.costing_unit,
            line_total_ex_vat: line.line_total_ex_vat,
            vat_rate: line.vat_rate,
            line_total_inc_vat: line.line_total_inc_vat,
            brand: line.brand ?? "",
            supplier_product_name: line.supplier_product_name ?? "",
          }))
        : [createEmptyLine()]
    )
    setExtractionWarnings([])
    setPrefillDone(false)
    setShowUpload(false)
    setSelectedFile(null)
    setError(null)
  }

  useEffect(() => {
    if (!open) return
    if (isEditMode && invoice) {
      populateFromInvoice(invoice)
    } else if (!isEditMode) {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, invoice])

  function prefillFromExtraction(extracted: PdfExtractResponse) {
    if (extracted.supplier_name) setSupplierName(extracted.supplier_name)
    if (extracted.invoice_number) setInvoiceNumber(extracted.invoice_number)
    if (extracted.invoice_date) setInvoiceDate(extracted.invoice_date)
    if (extracted.due_date) setDueDate(extracted.due_date)
    if (extracted.currency) setCurrency(extracted.currency)
    if (extracted.notes) setNotes(extracted.notes)
    if (extracted.vat_included !== undefined) setVatIncluded(extracted.vat_included)
    if (extracted.lines.length > 0) {
      setLines(
        extracted.lines.map((l) => ({
          ingredient_name: l.ingredient_name || "",
          ingredient_sku: l.ingredient_sku || "",
          category: l.category || "",
          quantity_purchased: l.quantity_purchased ?? 1,
          purchase_unit: l.purchase_unit || "unit",
          pack_size_value: l.pack_size_value ?? undefined,
          pack_size_unit: l.pack_size_unit || "",
          net_quantity_for_costing: l.net_quantity_for_costing ?? 1,
          costing_unit: l.costing_unit || "unit",
          line_total_ex_vat: l.line_total_ex_vat ?? 0,
          vat_rate: l.vat_rate ?? 0,
          line_total_inc_vat: l.line_total_inc_vat ?? 0,
          brand: l.brand || "",
          supplier_product_name: l.supplier_product_name || "",
        }))
      )
    }
    setExtractionWarnings(extracted.warnings || [])
    setPrefillDone(true)
    setShowUpload(false)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handlePdfUpload() {
    if (!selectedFile) return
    try {
      setUploading(true)
      setError(null)
      const extracted = await uploadCompanyPurchaseInvoicePdf(companyId, selectedFile)
      prefillFromExtraction(extracted)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract invoice from PDF.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(status: "draft" | "posted") {
    try {
      if (!supplierName.trim()) throw new Error("Supplier name is required.")
      if (!invoiceNumber.trim()) throw new Error("Invoice number is required.")
      if (!invoiceDate.trim()) throw new Error("Invoice date is required.")
      if (computedLines.some((l) => !l.ingredient_name.trim())) {
        throw new Error("Each line needs an ingredient name.")
      }
      if (computedLines.some((l) => Number(l.net_quantity_for_costing || 0) <= 0)) {
        throw new Error("Each line needs a net quantity greater than zero.")
      }

      setSaving(true)
      setError(null)

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
        lines: computedLines.map((l) => ({
          ingredient_name: l.ingredient_name.trim(),
          ingredient_sku: l.ingredient_sku?.trim() || null,
          category: l.category?.trim() || null,
          quantity_purchased: Number(l.quantity_purchased || 0),
          purchase_unit: l.purchase_unit.trim().toLowerCase(),
          pack_size_value: l.pack_size_value ? Number(l.pack_size_value) : null,
          pack_size_unit: l.pack_size_unit?.trim().toLowerCase() || null,
          net_quantity_for_costing: Number(l.net_quantity_for_costing || 0),
          costing_unit: l.costing_unit.trim().toLowerCase(),
          line_total_ex_vat: Number(l.line_total_ex_vat || 0),
          vat_rate: Number(l.vat_rate || 0),
          line_total_inc_vat: Number(l.line_total_inc_vat || 0),
          brand: l.brand?.trim() || null,
          supplier_product_name: l.supplier_product_name?.trim() || null,
        })),
      }

      if (isEditMode && invoice) {
        await updateCompanyPurchaseInvoice(invoice.id, payload)
      } else {
        await createCompanyPurchaseInvoice(companyId, payload)
      }
      resetForm()
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice.")
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <SlideOver open={open} onClose={handleClose} title={isEditMode ? "Edit invoice" : "New invoice"}>
      {/* Live totals bar */}
      <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <span>
            <span className="text-zinc-500">Ex VAT </span>
            <span className="font-semibold text-zinc-950">{fmtMoney(totals.subtotal)}</span>
          </span>
          <span>
            <span className="text-zinc-500">VAT </span>
            <span className="font-semibold text-zinc-950">{fmtMoney(totals.vatTotal)}</span>
          </span>
          <span>
            <span className="text-zinc-500">Inc VAT </span>
            <span className="font-semibold text-zinc-950">{fmtMoney(totals.totalInc)}</span>
          </span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {prefillDone ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium">Form pre-filled from PDF — review before saving</p>
                  {extractionWarnings.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-amber-800">
                      {extractionWarnings.map((w, i) => (
                        <li key={i}>· {w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => setPrefillDone(false)}
                className="shrink-0 rounded-lg border border-amber-200 p-1 text-amber-700 hover:bg-amber-100"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Section A – Invoice header */}
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
            Invoice header
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FLabel required>Supplier name</FLabel>
              <FInput
                value={supplierName}
                onChange={setSupplierName}
                placeholder="Musgraves, bakery supplier..."
              />
            </div>
            <div className="col-span-2">
              <FLabel required>Invoice number</FLabel>
              <FInput
                value={invoiceNumber}
                onChange={setInvoiceNumber}
                placeholder="INV-2026-041"
              />
            </div>
            <div>
              <FLabel required>Invoice date</FLabel>
              <FInput type="date" value={invoiceDate} onChange={setInvoiceDate} />
            </div>
            <div>
              <FLabel>Due date</FLabel>
              <FInput type="date" value={dueDate} onChange={setDueDate} />
            </div>
            <div>
              <FLabel>Currency</FLabel>
              <FSelect
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" },
                  { value: "USD", label: "USD" },
                ]}
              />
            </div>
            <div className="flex items-end">
              <label className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={vatIncluded}
                  onChange={(e) => setVatIncluded(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                VAT included
              </label>
            </div>
            <div className="col-span-2">
              <FLabel>Attachment placeholder</FLabel>
              <FInput
                value={attachmentName}
                onChange={setAttachmentName}
                placeholder="invoice-apr-23.pdf"
              />
            </div>
            <div className="col-span-2">
              <FLabel>Notes</FLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery notes, quality flags..."
                className="min-h-[72px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              />
            </div>
            <div className="col-span-2">
              <button
                onClick={() => setShowUpload((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <Upload size={14} />
                Upload PDF
              </button>
            </div>
            {showUpload ? (
              <div className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="flex-1 text-sm text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-zinc-700"
                  />
                  <button
                    onClick={handlePdfUpload}
                    disabled={!selectedFile || uploading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {uploading ? "Extracting…" : "Extract"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Section B – Ingredient lines */}
        <div className="border-t border-zinc-100 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
              Ingredient lines
            </p>
            <button
              onClick={addLine}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <Plus size={13} /> Add line
            </button>
          </div>

          <div className="space-y-3">
            {computedLines.map((line, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-700">Line {i + 1}</p>
                  <button
                    onClick={() => removeLine(i)}
                    disabled={computedLines.length === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 transition hover:text-zinc-950 disabled:opacity-40"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FLabel required>Ingredient name</FLabel>
                    <FInput
                      value={line.ingredient_name}
                      onChange={(v) => updateLine(i, { ingredient_name: v })}
                      placeholder="Flour, butter, coffee..."
                    />
                  </div>
                  <div>
                    <FLabel>Qty purchased</FLabel>
                    <FInput
                      type="number"
                      value={String(line.quantity_purchased)}
                      onChange={(v) => updateLine(i, { quantity_purchased: Number(v || 0) })}
                    />
                  </div>
                  <div>
                    <FLabel>Purchase unit</FLabel>
                    <FSelect
                      value={line.purchase_unit}
                      onChange={(v) => updateLine(i, { purchase_unit: v })}
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
                  </div>
                  <div>
                    <FLabel>Net qty for costing</FLabel>
                    <FInput
                      type="number"
                      value={String(line.net_quantity_for_costing)}
                      onChange={(v) =>
                        updateLine(i, { net_quantity_for_costing: Number(v || 0) })
                      }
                    />
                  </div>
                  <div>
                    <FLabel>Costing unit</FLabel>
                    <FSelect
                      value={line.costing_unit}
                      onChange={(v) => updateLine(i, { costing_unit: v })}
                      options={[
                        { value: "g", label: "g" },
                        { value: "ml", label: "ml" },
                        { value: "unit", label: "unit" },
                      ]}
                    />
                  </div>
                  <div>
                    <FLabel>Line total ex VAT</FLabel>
                    <FInput
                      type="number"
                      value={String(line.line_total_ex_vat)}
                      onChange={(v) => updateLine(i, { line_total_ex_vat: Number(v || 0) })}
                    />
                  </div>
                  <div>
                    <FLabel>VAT rate %</FLabel>
                    <FInput
                      type="number"
                      value={String(line.vat_rate)}
                      onChange={(v) => updateLine(i, { vat_rate: Number(v || 0) })}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-zinc-100 bg-white p-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                      Inc VAT
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                      {fmtMoney(line.line_total_inc_vat ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                      ex/{line.costing_unit}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-zinc-950">
                      {(line.normalized_ex_vat ?? 0).toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-zinc-400">
                      inc/{line.costing_unit}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-zinc-950">
                      {(line.normalized_inc_vat ?? 0).toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save as draft"}
          </button>
          <button
            onClick={() => handleSave("posted")}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? "Saving..." : isEditMode ? "Save changes" : "Post invoice"}
          </button>
        </div>
      </div>
    </SlideOver>
  )
}
