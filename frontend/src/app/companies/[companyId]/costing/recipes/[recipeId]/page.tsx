"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  deleteRecipe,
  duplicateRecipe,
  getCompanyById,
  getCompanyIngredients,
  getRecipeDetail,
  createCompanyRecipe,
  uploadRecipePhoto,
  updateRecipe,
  type Ingredient,
  type RecipeCreatePayload,
  type RecipeDetailResponse,
} from "@/services/api"
import ConfirmDialog from "@/components/confirm-dialog"
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Download,
  GripVertical,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  downloadRecipeReportPdf,
  generateRecipeReportPdf,
  printRecipeReportPdf,
  type RecipeReportOptions,
} from "@/lib/recipe-report"

// ── Types ─────────────────────────────────────────────────────────────────────

type RecipeLineDraft = {
  key: string
  ingredient_id: string
  quantity_required: string
  unit_used: string
}

type PrintOptions = {
  includeCosts: boolean
  includeNotes: boolean
  includePhoto: boolean
  includePricingSummary: boolean
}

type RecipeComputedRow = {
  key: string
  ingredient: Ingredient | undefined
  quantity: number
  unitUsed: string
  normalizedQuantity: number | null
  lineCostEx: number | null
  lineCostInc: number | null
  latestEx: number | null
  latestInc: number | null
  missingPrice: boolean
  unitMismatch: boolean
}

type RecipeComputedState = {
  ingredientRows: RecipeComputedRow[]
  warnings: string[]
  missingCount: number
  totalEx: number
  totalInc: number
  costPerYieldEx: number
  costPerYieldInc: number
  costPerPortionEx: number | null
  costPerPortionInc: number | null
  grossMarginValueEx: number | null
  grossMarginPercentEx: number | null
  foodCostPercent: number | null
  hasSellingPrice: boolean
  labourCost: number
  packagingCost: number
  ingredientsCost: number
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

function createEmptyLine(defaultIngredient?: Ingredient): RecipeLineDraft {
  return {
    key: crypto.randomUUID(),
    ingredient_id: defaultIngredient?.id ?? "",
    quantity_required: "1",
    unit_used: defaultIngredient?.default_unit_for_costing ?? "g",
  }
}

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
  return new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatRelative(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return formatDate(value)
}

function normalizeUnit(value: string) {
  return value.trim().toLowerCase()
}

function resolvePhotoUrl(value: string) {
  if (!value) return value
  if (value.startsWith("data:")) return value
  if (value.startsWith("blob:")) return value
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  if (value.startsWith("/")) {
    return `${API_URL.replace(/\/$/, "")}${value}`
  }
  return value
}

function unitFamily(unit: string) {
  const n = normalizeUnit(unit)
  if (["mg", "g", "kg"].includes(n)) return "weight"
  if (["ml", "l"].includes(n)) return "volume"
  if (n === "unit") return "unit"
  return null
}

function unitFactor(unit: string) {
  const n = normalizeUnit(unit)
  if (n === "mg") return 0.001
  if (n === "g") return 1
  if (n === "kg") return 1000
  if (n === "ml") return 1
  if (n === "l") return 1000
  if (n === "unit") return 1
  throw new Error(`Unsupported unit ${unit}`)
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  if (unitFamily(fromUnit) !== unitFamily(toUnit)) {
    throw new Error(`Cannot convert ${fromUnit} to ${toUnit}`)
  }
  return (quantity * unitFactor(fromUnit)) / unitFactor(toUnit)
}

function foodCostClass(value: number | null) {
  if (value == null) return "text-zinc-950"
  if (value < 30) return "text-emerald-700"
  if (value <= 40) return "text-amber-700"
  return "text-rose-700"
}

function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
      {children}
    </label>
  )
}

function FInput({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  suffix?: string
}) {
  if (suffix) {
    return (
      <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white focus-within:border-zinc-400">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none"
        />
        <span className="flex items-center border-l border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium text-zinc-500">
          {suffix}
        </span>
      </div>
    )
  }
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

// ── PhotoUpload ────────────────────────────────────────────────────────────────

function PhotoUpload({
  value,
  companyId,
  onChange,
  onUploadingChange,
}: {
  value: string
  companyId: string
  onChange: (v: string) => void
  onUploadingChange?: (busy: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [photoError, setPhotoError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState(value)

  const MAX_BYTES = 5 * 1024 * 1024
  const ALLOWED = ["image/jpeg", "image/png", "image/webp"]

  useEffect(() => {
    setPreviewSrc(value)
  }, [value])

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    },
    []
  )

  async function handleFile(file: File | undefined) {
    setPhotoError("")
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setPhotoError("Use JPG, PNG or WebP")
      return
    }
    if (file.size > MAX_BYTES) {
      setPhotoError("File must be under 5 MB")
      return
    }

    const localPreview = URL.createObjectURL(file)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = localPreview
    setPreviewSrc(localPreview)
    setUploading(true)
    onUploadingChange?.(true)

    try {
      const uploaded = await uploadRecipePhoto(companyId, file)
      onChange(uploaded.photo_url)
      setPreviewSrc(uploaded.photo_url)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not upload image")
      onChange("")
      setPreviewSrc("")
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0])
    e.target.value = ""
  }

  function clearPhoto() {
    onChange("")
    setPhotoError("")
    setPreviewSrc("")
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  const hasPreview = Boolean(previewSrc)

  if (hasPreview) {
    return (
      <div className="space-y-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
          <img src={resolvePhotoUrl(previewSrc)} alt="Recipe" className="h-full w-full object-cover" />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-zinc-700">
              Uploading…
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <RefreshCw size={12} /> Replace
          </button>
          <button
            type="button"
            onClick={clearPhoto}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            <X size={12} /> Remove
          </button>
        </div>
        {photoError ? <div className="text-xs text-red-600">{photoError}</div> : null}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`w-full rounded-xl border border-dashed px-5 py-10 text-center transition-colors ${
          isDragging
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white">
          <Upload size={16} className="text-zinc-500" />
        </div>
        <div className="text-sm font-medium text-zinc-900">Drop image or click to upload</div>
        <div className="mt-1 text-xs text-zinc-500">JPG, PNG or WebP · max 5 MB</div>
      </button>
      {photoError ? <div className="mt-2 text-xs text-red-600">{photoError}</div> : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function blankForm(defaultIngredient?: Ingredient) {
  return {
    recipeName: "",
    photoUrl: "",
    category: "",
    description: "",
    notes: "",
    yieldQuantity: "1",
    yieldUnit: "portion",
    portionSize: "",
    wastagePercent: "0",
    labourCostOverride: "",
    packagingCostOverride: "",
    targetFoodCostPercent: "",
    sellingPriceExVat: "",
    sellingPriceIncVat: "",
    isActive: true,
    lines: [createEmptyLine(defaultIngredient)],
  }
}

// ── Report dialog ─────────────────────────────────────────────────────────────

type ReportAction = "print" | "export"

function RecipeReportDialog({
  open,
  action,
  hasPhoto,
  defaultOptions,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  action: ReportAction
  hasPhoto: boolean
  defaultOptions: PrintOptions
  busy: boolean
  onCancel: () => void
  onSubmit: (options: PrintOptions) => void
}) {
  const [draft, setDraft] = useState<PrintOptions>(defaultOptions)

  useEffect(() => {
    if (open) setDraft(defaultOptions)
  }, [defaultOptions, open])

  useEffect(() => {
    if (!hasPhoto) setDraft((c) => ({ ...c, includePhoto: false }))
  }, [hasPhoto])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} />
      <div className="relative w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Recipe report</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-950">Choose report options</h3>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            A4 portrait
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This creates a dedicated Recipe Technical Sheet PDF. Costs stay off by default.
        </p>
        <div className="mt-5 space-y-3">
          {(
            [
              { key: "includeCosts", label: "Include costs", sub: "Show unit costs, line costs, recipe totals, and food cost percentage." },
              { key: "includeNotes", label: "Include notes", sub: "Include method, description, and any saved notes in the report." },
              { key: "includePricingSummary", label: "Include pricing / margin summary", sub: "Show selling price, cost summary, and contribution figures." },
            ] as const
          ).map(({ key, label, sub }) => (
            <label key={key} className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(e) => setDraft((c) => ({ ...c, [key]: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-950">{label}</span>
                <span className="block text-xs leading-5 text-zinc-500">{sub}</span>
              </span>
            </label>
          ))}
          <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${hasPhoto ? "border-zinc-200 bg-zinc-50" : "border-zinc-100 bg-zinc-50 opacity-60"}`}>
            <input
              type="checkbox"
              checked={draft.includePhoto}
              disabled={!hasPhoto}
              onChange={(e) => setDraft((c) => ({ ...c, includePhoto: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-zinc-300 disabled:opacity-50"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-950">Include photo</span>
              <span className="block text-xs leading-5 text-zinc-500">
                {hasPhoto ? "Print the saved recipe image at the top of the sheet." : "No recipe photo is saved yet."}
              </span>
            </span>
          </label>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(draft)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {action === "print" ? <Printer size={16} /> : <Download size={16} />}
            {busy ? "Preparing..." : action === "print" ? "Print PDF" : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecipeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string
  const recipeId = params.recipeId as string
  const createMode = recipeId === "new" || recipeId === "template-preview"

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipe, setRecipe] = useState<RecipeDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState(() => blankForm())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [companyName, setCompanyName] = useState("MarginFlow")
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportAction, setReportAction] = useState<ReportAction>("export")
  const [reportBusy, setReportBusy] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved">("idle")

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasInitialized = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(null as any)
  const historyRef = useRef<Array<typeof form>>([])
  const isUndoing = useRef(false)

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadPageData() {
    try {
      setLoading(true)
      setError(null)
      const [companyResponse, ingredientResponse, recipeResponse] = await Promise.all([
        getCompanyById(companyId),
        getCompanyIngredients(companyId, { view: "all" }),
        createMode ? Promise.resolve(null) : getRecipeDetail(recipeId),
      ])
      setCompanyName(companyResponse.name)
      setIngredients(ingredientResponse.ingredients)
      setRecipe(recipeResponse)

      if (recipeResponse) {
        setForm({
          recipeName: recipeResponse.recipe.recipe_name,
          photoUrl: recipeResponse.recipe.photo_url ?? "",
          category: recipeResponse.recipe.category ?? "",
          description: recipeResponse.recipe.description ?? "",
          notes: recipeResponse.recipe.notes ?? "",
          yieldQuantity: String(recipeResponse.recipe.yield_quantity ?? 1),
          yieldUnit: recipeResponse.recipe.yield_unit,
          portionSize: recipeResponse.recipe.portion_size != null ? String(recipeResponse.recipe.portion_size) : "",
          wastagePercent: String(recipeResponse.recipe.wastage_percent ?? 0),
          labourCostOverride: recipeResponse.recipe.labour_cost_override != null ? String(recipeResponse.recipe.labour_cost_override) : "",
          packagingCostOverride: recipeResponse.recipe.packaging_cost_override != null ? String(recipeResponse.recipe.packaging_cost_override) : "",
          targetFoodCostPercent: recipeResponse.recipe.target_food_cost_percent != null ? String(recipeResponse.recipe.target_food_cost_percent) : "",
          sellingPriceExVat: recipeResponse.recipe.selling_price_ex_vat != null ? String(recipeResponse.recipe.selling_price_ex_vat) : "",
          sellingPriceIncVat: recipeResponse.recipe.selling_price_inc_vat != null ? String(recipeResponse.recipe.selling_price_inc_vat) : "",
          isActive: recipeResponse.recipe.is_active,
          lines: recipeResponse.ingredients.length
            ? recipeResponse.ingredients.map((line) => ({
                key: line.id,
                ingredient_id: line.ingredient_id ?? "",
                quantity_required: String(line.quantity_required ?? 1),
                unit_used: line.unit_used,
              }))
            : [createEmptyLine(ingredientResponse.ingredients[0])],
        })
      } else {
        setForm(blankForm(ingredientResponse.ingredients[0]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe editor.")
    } finally {
      setLoading(false)
      hasInitialized.current = true
    }
  }

  useEffect(() => {
    loadPageData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, recipeId])

  // ── Computed ────────────────────────────────────────────────────────────────

  const ingredientLookup = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])

  const computed = useMemo<RecipeComputedState>(() => {
    let ingredientSubtotalEx = 0
    let ingredientSubtotalInc = 0
    let missingCount = 0
    const warnings: string[] = []

    const ingredientRows = form.lines.map((line, index) => {
      const ingredient = ingredientLookup.get(line.ingredient_id)
      const quantity = Number(line.quantity_required || 0)
      let normalizedQuantity: number | null = null
      let lineCostEx: number | null = null
      let lineCostInc: number | null = null
      let latestEx: number | null = null
      let latestInc: number | null = null
      let missingPrice = false
      let unitMismatch = false

      if (!ingredient) {
        missingPrice = true
        missingCount += 1
        warnings.push(`Line ${index + 1} has no ingredient selected.`)
      } else if (ingredient.latest_unit_cost_ex_vat == null || ingredient.latest_unit_cost_inc_vat == null) {
        missingPrice = true
        missingCount += 1
        warnings.push(`${ingredient.name} is missing a latest paid price.`)
      } else if (unitFamily(line.unit_used) !== unitFamily(ingredient.default_unit_for_costing)) {
        missingPrice = true
        unitMismatch = true
        missingCount += 1
        warnings.push(`${ingredient.name} is costed in ${ingredient.default_unit_for_costing}, but line ${index + 1} uses ${line.unit_used}.`)
      } else {
        latestEx = ingredient.latest_unit_cost_ex_vat
        latestInc = ingredient.latest_unit_cost_inc_vat
        normalizedQuantity = convertQuantity(quantity, line.unit_used, ingredient.default_unit_for_costing)
        lineCostEx = normalizedQuantity * latestEx
        lineCostInc = normalizedQuantity * latestInc
        ingredientSubtotalEx += lineCostEx
        ingredientSubtotalInc += lineCostInc
      }

      return { key: line.key, ingredient, quantity, unitUsed: line.unit_used, normalizedQuantity, lineCostEx, lineCostInc, latestEx, latestInc, missingPrice, unitMismatch }
    })

    const wastageMultiplier = 1 + Number(form.wastagePercent || 0) / 100
    const labourCost = Number(form.labourCostOverride || 0)
    const packagingCost = Number(form.packagingCostOverride || 0)
    const ingredientsCost = ingredientSubtotalEx * wastageMultiplier
    const totalEx = ingredientsCost + labourCost + packagingCost
    const totalInc = ingredientSubtotalInc * wastageMultiplier + labourCost + packagingCost
    const yieldQuantity = Number(form.yieldQuantity || 0) || 1
    const portionBase =
      Number(form.portionSize || 0) ||
      (["portion", "portions", "unit", "units"].includes(normalizeUnit(form.yieldUnit)) ? yieldQuantity : 0)
    const costPerYieldEx = totalEx / yieldQuantity
    const costPerYieldInc = totalInc / yieldQuantity
    const costPerPortionEx = portionBase > 0 ? totalEx / portionBase : null
    const costPerPortionInc = portionBase > 0 ? totalInc / portionBase : null
    const sellingPriceEx = Number(form.sellingPriceExVat || 0)
    const hasSellingPrice = sellingPriceEx > 0
    const grossMarginValueEx = hasSellingPrice ? sellingPriceEx - totalEx : null
    const grossMarginPercentEx = hasSellingPrice ? (((grossMarginValueEx ?? 0) / sellingPriceEx) * 100) : null
    const foodCostPercent = hasSellingPrice ? (totalEx / sellingPriceEx) * 100 : null

    return {
      ingredientRows, warnings, missingCount,
      totalEx, totalInc, costPerYieldEx, costPerYieldInc,
      costPerPortionEx, costPerPortionInc,
      grossMarginValueEx, grossMarginPercentEx, foodCostPercent, hasSellingPrice,
      labourCost, packagingCost, ingredientsCost,
    }
  }, [form, ingredientLookup])

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(silent = false) {
    if (loading || photoUploading) return
    try {
      setSaving(true)
      if (!silent) { setError(null); setSuccessMessage(null) }

      if (!form.recipeName.trim()) throw new Error("Recipe name is required.")
      if (!form.yieldUnit.trim()) throw new Error("Yield unit is required.")

      const ingredientsPayload = form.lines
        .filter((line) => line.ingredient_id.trim())
        .map((line, index) => {
          if (!line.quantity_required.trim()) throw new Error(`Line ${index + 1} needs a quantity.`)
          if (!line.unit_used.trim()) throw new Error(`Line ${index + 1} needs a unit.`)
          return {
            ingredient_id: line.ingredient_id,
            quantity_required: Number(line.quantity_required || 0),
            unit_used: normalizeUnit(line.unit_used),
          }
        })

      const payload: RecipeCreatePayload = {
        recipe_name: form.recipeName.trim(),
        photo_url: form.photoUrl.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        yield_quantity: Number(form.yieldQuantity || 1),
        yield_unit: normalizeUnit(form.yieldUnit),
        portion_size: form.portionSize.trim() ? Number(form.portionSize) : null,
        wastage_percent: Number(form.wastagePercent || 0),
        labour_cost_override: form.labourCostOverride.trim() ? Number(form.labourCostOverride) : null,
        packaging_cost_override: form.packagingCostOverride.trim() ? Number(form.packagingCostOverride) : null,
        target_food_cost_percent: form.targetFoodCostPercent.trim() ? Number(form.targetFoodCostPercent) : null,
        selling_price_ex_vat: form.sellingPriceExVat.trim() ? Number(form.sellingPriceExVat) : null,
        selling_price_inc_vat: form.sellingPriceIncVat.trim() ? Number(form.sellingPriceIncVat) : null,
        is_active: form.isActive,
        ingredients: ingredientsPayload,
      }

      const response = createMode
        ? await createCompanyRecipe(companyId, payload)
        : await updateRecipe(recipeId, payload)

      setRecipe(response)
      if (!silent) setSuccessMessage(`${response.recipe.recipe_name} saved.`)

      if (createMode) {
        router.replace(`/companies/${companyId}/costing/recipes/${response.recipe.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe.")
      throw err
    } finally {
      setSaving(false)
    }
  }

  // Keep ref current so auto-save timer always calls the latest closure
  handleSaveRef.current = handleSave

  async function handleDuplicate() {
    if (!recipe) return
    try {
      setSaving(true)
      setError(null)
      const response = await duplicateRecipe(recipe.recipe.id, {})
      setSuccessMessage(`Duplicated as ${response.recipe.recipe_name}.`)
      router.replace(`/companies/${companyId}/costing/recipes/${response.recipe.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate recipe.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!recipe) return
    try {
      setDeleteBusy(true)
      setError(null)
      await deleteRecipe(recipe.recipe.id)
      router.replace(`/companies/${companyId}/costing/recipes`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recipe.")
    } finally {
      setDeleteBusy(false)
    }
  }

  function buildRecipeReportPayload(): RecipeDetailResponse {
    const ingredientRows = form.lines.map((line, index) => {
      const ingredient = ingredientLookup.get(line.ingredient_id)
      const computedRow = computed.ingredientRows[index]
      const unitUsed = normalizeUnit(line.unit_used) || ingredient?.default_unit_for_costing || "unit"
      return {
        id: line.key,
        ingredient_id: ingredient?.id ?? line.ingredient_id ?? null,
        ingredient_name: ingredient?.name ?? "Missing ingredient",
        ingredient_default_unit_for_costing: ingredient?.default_unit_for_costing ?? unitUsed,
        line_order: index + 1,
        quantity_required: Number(line.quantity_required || 0),
        unit_used: unitUsed,
        normalized_quantity: computedRow?.normalizedQuantity ?? null,
        latest_unit_cost_ex_vat: computedRow?.latestEx ?? null,
        latest_unit_cost_inc_vat: computedRow?.latestInc ?? null,
        normalized_unit_cost_ex_vat: computedRow?.latestEx ?? null,
        normalized_unit_cost_inc_vat: computedRow?.latestInc ?? null,
        line_cost_ex_vat: computedRow?.lineCostEx ?? null,
        line_cost_inc_vat: computedRow?.lineCostInc ?? null,
        missing_price: computedRow?.missingPrice ?? true,
        unit_mismatch: computedRow?.unitMismatch ?? false,
        source_purchase_date: ingredient?.latest_purchase_date ?? null,
        source_supplier_name: ingredient?.latest_supplier_name ?? null,
      }
    })

    const sellingPriceExVat = Number(form.sellingPriceExVat || 0)
    const recipeIdValue = recipe?.recipe.id ?? "draft"
    const recipeName = form.recipeName.trim() || "Untitled recipe"
    const hasSellingPrice = sellingPriceExVat > 0

    return {
      recipe: {
        id: recipeIdValue,
        tenant_id: recipe?.recipe.tenant_id ?? "",
        company_id: recipe?.recipe.company_id ?? companyId,
        recipe_name: recipeName,
        normalized_name: recipeName.toLowerCase(),
        photo_url: form.photoUrl.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        yield_quantity: Number(form.yieldQuantity || 1) || 1,
        yield_unit: normalizeUnit(form.yieldUnit),
        portion_size: form.portionSize.trim() ? Number(form.portionSize) : null,
        wastage_percent: Number(form.wastagePercent || 0),
        labour_cost_override: form.labourCostOverride.trim() ? Number(form.labourCostOverride) : null,
        packaging_cost_override: form.packagingCostOverride.trim() ? Number(form.packagingCostOverride) : null,
        target_food_cost_percent: form.targetFoodCostPercent.trim() ? Number(form.targetFoodCostPercent) : null,
        selling_price_ex_vat: hasSellingPrice ? sellingPriceExVat : null,
        selling_price_inc_vat: form.sellingPriceIncVat.trim() ? Number(form.sellingPriceIncVat) : null,
        is_active: form.isActive,
        created_at: recipe?.recipe.created_at ?? null,
        updated_at: recipe?.recipe.updated_at ?? null,
        ingredient_count: ingredientRows.filter((row) => Boolean(row.ingredient_id)).length,
        missing_ingredient_count: computed.missingCount,
        total_recipe_cost_ex_vat: computed.totalEx,
        total_recipe_cost_inc_vat: computed.totalInc,
        cost_per_yield_ex_vat: computed.costPerYieldEx,
        cost_per_yield_inc_vat: computed.costPerYieldInc,
        cost_per_portion_ex_vat: computed.costPerPortionEx,
        cost_per_portion_inc_vat: computed.costPerPortionInc,
        gross_margin_value_ex_vat: computed.grossMarginValueEx,
        gross_margin_percent_ex_vat: computed.grossMarginPercentEx,
        markup_percent: null,
        food_cost_percent: computed.foodCostPercent,
        has_missing_costs: computed.missingCount > 0,
      },
      ingredients: ingredientRows,
      warnings: computed.warnings,
    }
  }

  async function handleReport(action: ReportAction, options: PrintOptions) {
    if (createMode) return
    try {
      setReportBusy(true)
      setError(null)
      const payload = buildRecipeReportPayload()
      const reportOptions: RecipeReportOptions = {
        includeCosts: options.includeCosts,
        includeNotes: options.includeNotes,
        includePhoto: options.includePhoto,
        includePricingSummary: options.includePricingSummary,
      }
      const { blob, fileName } = await generateRecipeReportPdf({ companyName, recipe: payload, options: reportOptions })
      if (action === "print") {
        await printRecipeReportPdf(blob)
      } else {
        await downloadRecipeReportPdf(blob, fileName)
      }
      setReportDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recipe report.")
    } finally {
      setReportBusy(false)
    }
  }

  function openReportDialog(action: ReportAction) {
    setReportAction(action)
    setReportDialogOpen(true)
  }

  // ── Line helpers ────────────────────────────────────────────────────────────

  function updateLine(index: number, patch: Partial<RecipeLineDraft>) {
    setForm((c) => ({ ...c, lines: c.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))
  }

  function addLine() {
    setForm((c) => ({ ...c, lines: [...c.lines, createEmptyLine(ingredients[0])] }))
  }

  function removeLine(index: number) {
    setForm((c) => ({ ...c, lines: c.lines.length === 1 ? c.lines : c.lines.filter((_, i) => i !== index) }))
  }

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.effectAllowed = "move"
    setDragIndex(index)
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function onDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      setForm((c) => {
        const lines = [...c.lines]
        const [moved] = lines.splice(dragIndex, 1)
        lines.splice(index, 0, moved)
        return { ...c, lines }
      })
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function onDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // ── Auto-save ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasInitialized.current || createMode) return
    setAutoSaveStatus("pending")
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaveStatus("saving")
        await handleSaveRef.current(true)
        setAutoSaveStatus("saved")
        setTimeout(() => setAutoSaveStatus("idle"), 2500)
      } catch {
        setAutoSaveStatus("idle")
      }
    }, 2000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // ── Undo history ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasInitialized.current) return
    if (isUndoing.current) { isUndoing.current = false; return }
    historyRef.current = [...historyRef.current.slice(-9), form]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const history = historyRef.current
        if (history.length < 2) return
        e.preventDefault()
        isUndoing.current = true
        const prev = history[history.length - 2]
        historyRef.current = history.slice(0, -1)
        setForm(prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activeRecipeName = form.recipeName.trim() || "New recipe"

  const defaultReportOptions = useMemo<PrintOptions>(
    () => ({ includeCosts: false, includeNotes: true, includePhoto: Boolean(form.photoUrl.trim()), includePricingSummary: false }),
    [form.photoUrl]
  )

  // Cost breakdown proportions
  const totalForBreakdown = computed.totalEx || 1
  const ingPct = Math.round((computed.ingredientsCost / totalForBreakdown) * 100)
  const labPct = Math.round((computed.labourCost / totalForBreakdown) * 100)
  const pakPct = Math.max(0, 100 - ingPct - labPct)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-16">

      {/* ── Header ── */}
      <div>
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <Link href={`/companies/${companyId}/costing/purchase-invoices`} className="hover:text-zinc-700 transition">
            Costing
          </Link>
          <span>›</span>
          <Link href={`/companies/${companyId}/costing/recipes`} className="hover:text-zinc-700 transition">
            Recipes
          </Link>
          <span>›</span>
          <span className="max-w-[200px] truncate text-zinc-600">{activeRecipeName}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          {/* Inline name */}
          <div className="group relative flex min-w-0 flex-1 items-center gap-2">
            <input
              value={form.recipeName}
              onChange={(e) => setForm((c) => ({ ...c, recipeName: e.target.value }))}
              placeholder="Recipe name…"
              className="min-w-0 flex-1 bg-transparent text-2xl font-[500] text-zinc-950 outline-none placeholder:text-zinc-300"
            />
            <Pencil size={14} className="shrink-0 text-zinc-300 transition group-focus-within:text-zinc-500" />
          </div>

          {/* Status pill */}
          <button
            onClick={() => setForm((c) => ({ ...c, isActive: !c.isActive }))}
            className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] transition ${
              form.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {form.isActive ? "Active" : "Inactive"}
          </button>

          {/* Auto-save indicator */}
          {!createMode && autoSaveStatus !== "idle" ? (
            <span className="shrink-0 text-xs text-zinc-400">
              {autoSaveStatus === "saving" ? "Saving…" : autoSaveStatus === "saved" ? "Saved" : ""}
            </span>
          ) : null}

          {/* Secondary icon actions */}
          {!createMode ? (
            <>
              <div className="flex items-center gap-1">
                <button onClick={() => openReportDialog("print")} title="Print" disabled={saving || loading || photoUploading}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-40">
                  <Printer size={15} />
                </button>
                <button onClick={() => openReportDialog("export")} title="Export PDF" disabled={saving || loading || photoUploading}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-40">
                  <Download size={15} />
                </button>
                <button onClick={handleDuplicate} title="Duplicate" disabled={saving || photoUploading}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-40">
                  <Copy size={15} />
                </button>
                <button onClick={() => setDeleteConfirmOpen(true)} title="Delete" disabled={saving || photoUploading}
                  className="rounded-lg border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50 disabled:opacity-40">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="h-5 w-px shrink-0 bg-zinc-200" />
            </>
          ) : null}

          <button
            onClick={() => handleSave()}
            disabled={saving || loading || photoUploading}
            className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? "Saving…" : createMode ? "Create recipe" : "Save recipe"}
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {successMessage && autoSaveStatus === "idle" ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      {/* ── Metrics bar — connected cards ── */}
      <div className="flex divide-x divide-zinc-200 overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex-1 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Cost ex VAT</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{fmtMoney(computed.totalEx)}</p>
        </div>
        <div className="flex-1 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Cost per portion</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {computed.costPerPortionEx == null ? "-" : fmtMoney(computed.costPerPortionEx)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {form.yieldQuantity || 1} {form.yieldUnit}
          </p>
        </div>
        <div className="flex-1 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Selling price</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {form.sellingPriceExVat ? fmtMoney(Number(form.sellingPriceExVat)) : "-"}
          </p>
          {form.sellingPriceIncVat ? (
            <p className="mt-1 text-xs text-zinc-500">{fmtMoney(Number(form.sellingPriceIncVat))} inc VAT</p>
          ) : null}
        </div>
        <div className="flex-1 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Food cost %</p>
          <p className={`mt-2 text-2xl font-semibold tracking-tight ${foodCostClass(computed.foodCostPercent)}`}>
            {fmtPercent(computed.foodCostPercent)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {!computed.hasSellingPrice
              ? "Enter selling price to unlock"
              : computed.foodCostPercent != null && computed.foodCostPercent < 30
              ? "Within target (30%)"
              : "Above target (30%)"}
          </p>
        </div>
      </div>

      {/* ── Cost warnings ── */}
      {computed.warnings.length > 0 ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {computed.missingCount} line{computed.missingCount === 1 ? "" : "s"} with missing price or unit mismatch
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-amber-800">
                {computed.warnings.map((w) => <li key={w}>· {w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 2-column layout ── */}
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">

        {/* LEFT */}
        <div className="space-y-6">

          {/* A) Ingredients */}
          <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-zinc-100 px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Ingredients</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="w-7 px-3 py-3" />
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Ingredient</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Qty</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Unit</th>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Unit cost</th>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Line cost</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">% of total</th>
                    <th className="w-8 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => {
                    const row = computed.ingredientRows[index]
                    const selectedIngredient = ingredientLookup.get(line.ingredient_id)
                    const pctOfTotal =
                      row.lineCostEx != null && computed.totalEx > 0
                        ? (row.lineCostEx / computed.totalEx) * 100
                        : null
                    const isDragOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index

                    return (
                      <tr
                        key={line.key}
                        draggable
                        onDragStart={(e) => onDragStart(e, index)}
                        onDragOver={(e) => onDragOver(e, index)}
                        onDrop={() => onDrop(index)}
                        onDragEnd={onDragEnd}
                        className={`border-t border-zinc-100 transition ${isDragOver ? "bg-blue-50" : "hover:bg-zinc-50"}`}
                      >
                        {/* Drag handle */}
                        <td className="cursor-grab px-3 py-3 text-zinc-300 active:cursor-grabbing">
                          <GripVertical size={14} />
                        </td>

                        {/* Ingredient select + audit trail */}
                        <td className="px-3 py-3">
                          <select
                            value={line.ingredient_id}
                            onChange={(e) => {
                              const next = ingredientLookup.get(e.target.value)
                              updateLine(index, { ingredient_id: e.target.value, unit_used: next?.default_unit_for_costing ?? line.unit_used })
                            }}
                            className="w-full min-w-[160px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                          >
                            <option value="">Select ingredient</option>
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>{ing.name} ({ing.default_unit_for_costing})</option>
                            ))}
                          </select>
                          {selectedIngredient?.latest_supplier_name ? (
                            <p className="mt-0.5 text-[11px] text-zinc-400">
                              From {selectedIngredient.latest_supplier_name}
                              {selectedIngredient.latest_purchase_date ? ` · ${formatDate(selectedIngredient.latest_purchase_date)}` : ""}
                            </p>
                          ) : null}
                          {row.missingPrice && selectedIngredient ? (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertTriangle size={10} />
                              {row.unitMismatch ? "Unit mismatch" : "Missing price — add invoice"}
                            </div>
                          ) : null}
                        </td>

                        {/* Qty */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.quantity_required}
                            onChange={(e) => updateLine(index, { quantity_required: e.target.value })}
                            className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-3 py-3">
                          <input
                            value={line.unit_used}
                            onChange={(e) => updateLine(index, { unit_used: normalizeUnit(e.target.value) })}
                            placeholder="g"
                            className="w-16 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                          />
                        </td>

                        {/* Unit cost */}
                        <td className="px-3 py-3 text-right text-xs text-zinc-600">
                          {row.latestEx != null && selectedIngredient
                            ? fmtUnitCost(row.latestEx, selectedIngredient.default_unit_for_costing)
                            : "-"}
                        </td>

                        {/* Line cost */}
                        <td className="px-3 py-3 text-right font-medium text-zinc-950">
                          {row.lineCostEx == null ? <span className="text-zinc-400">-</span> : fmtMoney(row.lineCostEx)}
                        </td>

                        {/* % of total with bar */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-zinc-800"
                                style={{ width: `${Math.min(100, pctOfTotal ?? 0)}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-600">
                              {pctOfTotal == null ? "-" : `${pctOfTotal.toFixed(1)}%`}
                            </span>
                          </div>
                        </td>

                        {/* Remove */}
                        <td className="px-3 py-3">
                          <button
                            onClick={() => removeLine(index)}
                            disabled={form.lines.length === 1}
                            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 opacity-0 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-0 group-hover:opacity-100"
                            tabIndex={-1}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                    <td colSpan={5} className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Total</td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-zinc-950">{fmtMoney(computed.totalEx)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-zinc-950">100%</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-4">
              <button
                onClick={addLine}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700"
              >
                <Plus size={14} />
                Add ingredient
              </button>
            </div>
          </div>

          {/* B) Recipe Details */}
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Recipe details</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FLabel>Category</FLabel>
                <FInput value={form.category} onChange={(v) => setForm((c) => ({ ...c, category: v }))} placeholder="Bakery, drinks…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FLabel>Yield qty</FLabel>
                  <FInput type="number" value={form.yieldQuantity} onChange={(v) => setForm((c) => ({ ...c, yieldQuantity: v }))} />
                </div>
                <div>
                  <FLabel>Yield unit</FLabel>
                  <FInput value={form.yieldUnit} onChange={(v) => setForm((c) => ({ ...c, yieldUnit: v }))} placeholder="portion…" />
                </div>
              </div>
              <div>
                <FLabel>Selling price ex VAT</FLabel>
                <FInput type="number" suffix="€" value={form.sellingPriceExVat} onChange={(v) => setForm((c) => ({ ...c, sellingPriceExVat: v }))} placeholder="0.00" />
              </div>
              <div>
                <FLabel>Selling price inc VAT</FLabel>
                <FInput type="number" suffix="€" value={form.sellingPriceIncVat} onChange={(v) => setForm((c) => ({ ...c, sellingPriceIncVat: v }))} placeholder="0.00" />
              </div>
            </div>

            {/* Advanced settings */}
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-zinc-500 transition hover:text-zinc-800"
              >
                <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Advanced settings
              </button>
              {showAdvanced ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <FLabel>Portion size</FLabel>
                    <FInput type="number" value={form.portionSize} onChange={(v) => setForm((c) => ({ ...c, portionSize: v }))} placeholder="Optional" />
                  </div>
                  <div>
                    <FLabel>Wastage</FLabel>
                    <FInput type="number" suffix="%" value={form.wastagePercent} onChange={(v) => setForm((c) => ({ ...c, wastagePercent: v }))} />
                  </div>
                  <div>
                    <FLabel>Labour override</FLabel>
                    <FInput type="number" suffix="€" value={form.labourCostOverride} onChange={(v) => setForm((c) => ({ ...c, labourCostOverride: v }))} placeholder="0.00" />
                  </div>
                  <div>
                    <FLabel>Packaging override</FLabel>
                    <FInput type="number" suffix="€" value={form.packagingCostOverride} onChange={(v) => setForm((c) => ({ ...c, packagingCostOverride: v }))} placeholder="0.00" />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Method + Notes */}
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <FLabel>Method</FLabel>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Preparation steps…"
                  className="min-h-[96px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
              </div>
              <div>
                <FLabel>Allergens / notes</FLabel>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                  placeholder="Allergen notes, prep context…"
                  className="min-h-[96px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — sticky */}
        <div className="space-y-4 lg:sticky lg:top-6">

          {/* C) Photo upload */}
          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Photo</p>
            <PhotoUpload
              value={form.photoUrl}
              companyId={companyId}
              onChange={(v) => setForm((c) => ({ ...c, photoUrl: v }))}
              onUploadingChange={setPhotoUploading}
            />
          </div>

          {/* D) Cost breakdown */}
          {computed.totalEx > 0 ? (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Cost breakdown</p>

              {/* Stacked bar */}
              <div className="flex h-3 overflow-hidden rounded-full">
                {ingPct > 0 ? <div className="bg-blue-500" style={{ width: `${ingPct}%` }} /> : null}
                {labPct > 0 ? <div className="bg-emerald-500" style={{ width: `${labPct}%` }} /> : null}
                {pakPct > 0 && (computed.packagingCost > 0 || labPct + ingPct < 100) ? <div className="bg-amber-500" style={{ width: `${pakPct}%` }} /> : null}
              </div>

              {/* Legend */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-zinc-600">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Ingredients
                  </span>
                  <span className="font-medium text-zinc-950">{fmtMoney(computed.ingredientsCost)}</span>
                </div>
                {computed.labourCost > 0 ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Labour
                    </span>
                    <span className="font-medium text-zinc-950">{fmtMoney(computed.labourCost)}</span>
                  </div>
                ) : null}
                {computed.packagingCost > 0 ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-600">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Packaging
                    </span>
                    <span className="font-medium text-zinc-950">{fmtMoney(computed.packagingCost)}</span>
                  </div>
                ) : null}
              </div>

              {/* Margin stats */}
              {computed.hasSellingPrice ? (
                <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Gross margin</span>
                    <span className="font-semibold text-zinc-950">{fmtMoney(computed.grossMarginValueEx)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Margin %</span>
                    <span className={`font-semibold ${(computed.grossMarginPercentEx ?? 0) >= 60 ? "text-emerald-700" : "text-zinc-950"}`}>
                      {fmtPercent(computed.grossMarginPercentEx)}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Last updated */}
              <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
                Last saved {formatRelative(recipe?.recipe.updated_at)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete recipe?"
        description={recipe ? `Deleting ${recipe.recipe.recipe_name} will remove the recipe and all its ingredient lines. This cannot be undone.` : ""}
        confirmLabel="Delete recipe"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => { setDeleteConfirmOpen(false); await handleDelete() }}
      />
      <RecipeReportDialog
        open={reportDialogOpen}
        action={reportAction}
        hasPhoto={Boolean(form.photoUrl.trim())}
        defaultOptions={defaultReportOptions}
        busy={reportBusy}
        onCancel={() => setReportDialogOpen(false)}
        onSubmit={async (options) => { await handleReport(reportAction, options) }}
      />
    </div>
  )
}
