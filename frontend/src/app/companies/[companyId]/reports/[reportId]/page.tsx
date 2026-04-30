"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  createWeeklyReportItem,
  deleteWeeklyReportItem,
  getFinancialCategories,
  getWeeklyReportBreakdown,
  getWeeklyReportById,
  updateWeeklyReport,
  type FinancialCategory,
  type WeeklyReportBreakdownResponse,
  type WeeklyReportDetail,
  type WeeklyReportUpdatePayload,
} from "@/services/api"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  AlertTriangle,
  Layers3,
  Mail,
  Percent,
  Plus,
  ReceiptText,
  Save,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  LoaderCircle,
  Wallet,
  X,
} from "lucide-react"
import {
  buildWeekLabel as buildWeekLabelFromWeekEnding,
  formatDateInput,
  formatDateLong,
  getWeekInfo,
  normalizeWeekEndingToSunday,
} from "@/lib/report-utils"

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value?: string | null) {
  return value ? formatDateLong(value) : "-"
}

function buildWeekLabel(report: WeeklyReportDetail | null) {
  if (!report) return "Weekly Report"

  if (report.iso_week && report.week_start && report.week_end) {
    return buildWeekLabelFromWeekEnding(report.week_ending)
  }

  return formatDate(report.week_ending)
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function TooltipIcon({ definition }: { definition: string }) {
  return (
    <div className="group relative inline-flex items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 cursor-help text-zinc-400 opacity-40 transition-opacity duration-150 group-hover:opacity-80"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <div
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 w-52 -translate-x-1/2",
          "rounded-2xl bg-zinc-900 px-3 py-2.5 text-xs leading-5 text-zinc-100 shadow-xl",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        )}
      >
        {definition}
        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-zinc-900" />
      </div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  icon,
  children,
  className = "",
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200/70">
            {icon}
          </div>
        ) : null}

        <div>
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-950">
            {title}
          </h3>
          {description ? <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function SubCard({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-zinc-50/60 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] md:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        {icon ? <span className="text-zinc-500">{icon}</span> : null}
        <h4 className="text-sm font-semibold text-zinc-950">{title}</h4>
      </div>
      {children}
    </div>
  )
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
      />
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </label>
      <div className="flex h-11 items-center rounded-2xl border border-zinc-200 bg-white px-4 transition focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100">
        <span className="mr-2 text-sm font-medium text-zinc-500">€</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:text-zinc-500"
        />
      </div>
    </div>
  )
}

function PercentField({
  label,
  value,
  onChange,
  placeholder = "30",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </label>
      <div className="flex h-11 items-center rounded-2xl border border-zinc-200 bg-white px-4 transition focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <span className="ml-2 text-sm font-medium text-zinc-500">%</span>
      </div>
    </div>
  )
}

function KPI({
  icon,
  label,
  value,
  caption,
  tone = "default",
  tooltip,
}: {
  icon: React.ReactNode
  label: string
  value: string
  caption: string
  tone?: "default" | "success" | "warning"
  tooltip?: string
}) {
  return (
    <div className="relative rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-sm md:p-5">
      {tooltip ? (
        <div className="absolute right-4 top-4">
          <TooltipIcon definition={tooltip} />
        </div>
      ) : null}
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200/70">
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-[2rem] font-semibold tracking-tight md:text-[2.15rem]",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "default" && "text-zinc-950"
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{caption}</p>
    </div>
  )
}

function ExecutiveRow({
  label,
  value,
  valueClassName = "",
  tooltip,
}: {
  label: string
  value: string
  valueClassName?: string
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <span className="flex items-center gap-1.5 text-sm text-zinc-500">
        {label}
        {tooltip ? <TooltipIcon definition={tooltip} /> : null}
      </span>
      <span className={cn("text-sm font-semibold text-zinc-950", valueClassName)}>{value}</span>
    </div>
  )
}

function Signal({
  children,
  tone = "neutral",
  tooltip,
}: {
  children: React.ReactNode
  tone?: "neutral" | "good" | "warn"
  tooltip?: string
}) {
  const styles =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-zinc-200/70 bg-zinc-50/80 text-zinc-700"

  return (
    <div className={cn("relative rounded-2xl border px-4 py-3.5 pr-8 text-sm leading-6", styles)}>
      {tooltip ? (
        <div className="absolute right-3 top-3">
          <TooltipIcon definition={tooltip} />
        </div>
      ) : null}
      {children}
    </div>
  )
}

function buildSaveSignature(payload: WeeklyReportUpdatePayload) {
  return JSON.stringify([
    payload.company_id,
    payload.week_ending,
    payload.sales_inc_vat,
    payload.sales_ex_vat,
    payload.wages,
    payload.holiday_pay,
    payload.food_cost,
    payload.fixed_costs,
    payload.variable_costs,
    payload.loans_hp,
    payload.vat_due,
    payload.notes || "",
  ])
}

function getSaveToneClass(tone: "neutral" | "warn" | "danger" | "success") {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-700"
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-zinc-200 bg-zinc-50 text-zinc-700"
}

function getTypePillClass(type?: string | null) {
  const value = (type || "").toLowerCase()
  if (value === "expense") return "bg-rose-50 text-rose-700 border border-rose-200"
  if (value === "cogs") return "bg-amber-50 text-amber-700 border border-amber-200"
  if (value === "revenue") return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  return "bg-zinc-50 text-zinc-700 border border-zinc-200"
}

function getGroupPillClass(group?: string | null) {
  if (!group) return "bg-zinc-50 text-zinc-600 border border-zinc-200"
  return "bg-sky-50 text-sky-700 border border-sky-200"
}

export default function WeeklyReportDetailPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const reportId = params.reportId as string

  const [report, setReport] = useState<WeeklyReportDetail | null>(null)
  const [breakdown, setBreakdown] = useState<WeeklyReportBreakdownResponse | null>(null)
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<"pdf" | "email" | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedSignature, setLastSavedSignature] = useState("")
  const [savedJustNow, setSavedJustNow] = useState(false)

  const [foodCostMode, setFoodCostMode] = useState<"manual" | "percent">("manual")
  const [foodCostPercent, setFoodCostPercent] = useState("30")

  const [form, setForm] = useState<WeeklyReportUpdatePayload>({
    company_id: companyId,
    week_ending: "",
    sales_inc_vat: 0,
    sales_ex_vat: 0,
    wages: 0,
    holiday_pay: 0,
    food_cost: 0,
    fixed_costs: 0,
    variable_costs: 0,
    loans_hp: 0,
    vat_due: 0,
    notes: "",
  })

  const [newItem, setNewItem] = useState({
    category_id: "",
    amount: "",
    notes: "",
  })

  const autosaveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef(false)
  const savePromiseRef = useRef<Promise<WeeklyReportDetail> | null>(null)
  const lastSavedSignatureRef = useRef("")
  const currentSignatureRef = useRef("")
  const currentPayloadRef = useRef<WeeklyReportUpdatePayload | null>(null)
  const savedJustNowTimerRef = useRef<number | null>(null)

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)

        const [data, breakdownData, categoriesData] = await Promise.all([
          getWeeklyReportById(reportId),
          getWeeklyReportBreakdown(reportId),
          getFinancialCategories(),
        ])

        setReport(data)
        setBreakdown(breakdownData)
        setCategories(categoriesData.filter((c) => c.is_active))

        setForm({
          company_id: data.company_id,
          week_ending: formatDateInput(data.week_ending),
          sales_inc_vat: data.sales_inc_vat || 0,
          sales_ex_vat: data.sales_ex_vat || 0,
          wages: data.wages || 0,
          holiday_pay: data.holiday_pay || 0,
          food_cost: data.food_cost || 0,
          fixed_costs: data.fixed_costs || 0,
          variable_costs: data.variable_costs || 0,
          loans_hp: data.loans_hp || 0,
          vat_due: data.vat_due || 0,
          notes: data.notes || "",
        })

        if ((data.food_cost || 0) > 0 && (data.sales_ex_vat || 0) > 0) {
          const pct = ((data.food_cost || 0) / (data.sales_ex_vat || 1)) * 100
          setFoodCostPercent(pct.toFixed(2))
        }

        const initialPayload: WeeklyReportUpdatePayload = {
          company_id: data.company_id,
          week_ending: formatDateInput(normalizeWeekEndingToSunday(data.week_ending)),
          sales_inc_vat: data.sales_inc_vat || 0,
          sales_ex_vat: data.sales_ex_vat || 0,
          wages: data.wages || 0,
          holiday_pay: data.holiday_pay || 0,
          food_cost: data.food_cost || 0,
          fixed_costs: data.fixed_costs || 0,
          variable_costs: data.variable_costs || 0,
          loans_hp: data.loans_hp || 0,
          vat_due: data.vat_due || 0,
          notes: data.notes || "",
        }
        const initialSignature = buildSaveSignature(initialPayload)
        setLastSavedSignature(initialSignature)
        lastSavedSignatureRef.current = initialSignature
        currentSignatureRef.current = initialSignature
        currentPayloadRef.current = initialPayload
        setSaveError(null)
        setSavedJustNow(false)
      } catch (err) {
        console.error("Report detail error:", err)
        setError(err instanceof Error ? err.message : "Failed to load weekly report.")
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId, companyId])

  const isoWeekInfo = useMemo(() => getWeekInfo(form.week_ending), [form.week_ending])

  const salesExVat = Number(form.sales_ex_vat || 0)
  const labourTotal = Number(form.wages || 0) + Number(form.holiday_pay || 0)

  const computedFoodCost = useMemo(() => {
    if (foodCostMode === "percent") {
      return salesExVat * (Number(foodCostPercent || 0) / 100)
    }
    return Number(form.food_cost || 0)
  }, [foodCostMode, foodCostPercent, salesExVat, form.food_cost])

  const grossProfit = useMemo(() => salesExVat - computedFoodCost, [salesExVat, computedFoodCost])

  const netProfit = useMemo(() => {
    return (
      salesExVat -
      labourTotal -
      computedFoodCost -
      Number(form.fixed_costs || 0) -
      Number(form.variable_costs || 0) -
      Number(form.loans_hp || 0) -
      Number(form.vat_due || 0)
    )
  }, [
    salesExVat,
    labourTotal,
    computedFoodCost,
    form.fixed_costs,
    form.variable_costs,
    form.loans_hp,
    form.vat_due,
  ])

  const grossMarginPct = useMemo(() => {
    if (salesExVat <= 0) return 0
    return grossProfit / salesExVat
  }, [salesExVat, grossProfit])

  const netMarginPct = useMemo(() => {
    if (salesExVat <= 0) return 0
    return netProfit / salesExVat
  }, [salesExVat, netProfit])

  const labourPct = useMemo(() => {
    if (salesExVat <= 0) return 0
    return labourTotal / salesExVat
  }, [salesExVat, labourTotal])

  const currentPayload = useMemo<WeeklyReportUpdatePayload>(() => {
    return {
      ...form,
      company_id: form.company_id,
      week_ending: formatDateInput(normalizeWeekEndingToSunday(form.week_ending)),
      food_cost: Number(computedFoodCost.toFixed(2)),
    }
  }, [form, computedFoodCost])

  const currentSignature = useMemo(() => buildSaveSignature(currentPayload), [currentPayload])
  const hasUnsavedChanges = currentSignature !== lastSavedSignature
  const saveStatus = useMemo(() => {
    if (saving) {
      return {
        label: "Saving...",
        helper: "Autosaves when you edit.",
        tone: "neutral" as const,
        icon: <LoaderCircle size={14} className="animate-spin" />,
      }
    }

    if (saveError && hasUnsavedChanges) {
      return {
        label: "Save failed",
        helper: "Retry now to sync your latest changes.",
        tone: "danger" as const,
        icon: <AlertTriangle size={14} />,
      }
    }

    if (hasUnsavedChanges) {
      return {
        label: "Unsaved changes",
        helper: "Autosaves when you edit.",
        tone: "warn" as const,
        icon: <AlertTriangle size={14} />,
      }
    }

    if (savedJustNow) {
      return {
        label: "Saved just now",
        helper: "Autosaves when you edit.",
        tone: "success" as const,
        icon: <CheckCircle2 size={14} />,
      }
    }

    return {
      label: "All changes saved",
      helper: "Autosaves when you edit.",
      tone: "success" as const,
      icon: <CheckCircle2 size={14} />,
    }
  }, [hasUnsavedChanges, saveError, savedJustNow, saving])

  useEffect(() => {
    currentSignatureRef.current = currentSignature
    currentPayloadRef.current = currentPayload
  }, [currentSignature, currentPayload])

  useEffect(() => {
    if (!saveError) return
    if (currentSignature !== lastSavedSignature) {
      setSaveError(null)
    }
  }, [currentSignature, lastSavedSignature, saveError])

  const breakdownLineCount = breakdown?.items.length || 0

  const breakdownTotal = useMemo(() => {
    if (!breakdown) return 0
    return breakdown.items.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [breakdown])

  const topBreakdownItem = useMemo(() => {
    if (!breakdown || breakdown.items.length === 0) return null
    return [...breakdown.items].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0]
  }, [breakdown])

  const healthLabel = useMemo(() => {
    if (netMarginPct >= 0.18 && labourPct <= 0.32) return "Healthy Week"
    if (netMarginPct >= 0.1) return "Watch Closely"
    return "Needs Attention"
  }, [netMarginPct, labourPct])

  const healthBadgeClass = useMemo(() => {
    if (netMarginPct >= 0.18 && labourPct <= 0.32) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    }
    if (netMarginPct >= 0.1) {
      return "border-amber-200 bg-amber-50 text-amber-700"
    }
    return "border-rose-200 bg-rose-50 text-rose-700"
  }, [netMarginPct, labourPct])

  const goodSignals = useMemo(() => {
    const signals: Array<{ text: string; tooltip: string }> = []

    if (netMarginPct >= 0.18) {
      signals.push({
        text: "Strong week. Profitability is healthy and the business is operating inside a good efficiency range.",
        tooltip:
          "Net Margin ≥18%: Net Profit ÷ Revenue × 100. The business is above the healthy threshold for weekly operations.",
      })
    }

    if (grossMarginPct >= 0.65) {
      signals.push({
        text: "Gross margin is holding well. Core product margin looks solid this week.",
        tooltip:
          "Gross Margin ≥65%: Gross Profit ÷ Revenue × 100. A strong product margin before labour and overhead costs.",
      })
    }

    if (breakdownLineCount > 0) {
      signals.push({
        text: "Categorized P&L structure is active. Breakdown lines are helping standardize the weekly report.",
        tooltip:
          "P&L Breakdown: Categorized financial lines that provide a structured, consistent view of weekly costs and revenue.",
      })
    }

    return signals
  }, [netMarginPct, grossMarginPct, breakdownLineCount])

  const warningSignals = useMemo(() => {
    const signals: Array<{ text: string; tooltip: string }> = []

    if (netMarginPct < 0.1) {
      signals.push({
        text: "Margin is under target. Focus on cost control, pricing discipline and operational efficiency.",
        tooltip:
          "Net Margin <10%: Net Profit ÷ Revenue × 100. Currently below the 10% minimum healthy threshold — prioritize cost reduction.",
      })
    }

    if (labourPct > 0.35) {
      signals.push({
        text: "Labour pressure is high for the current revenue level. Review rota efficiency and staffing mix.",
        tooltip:
          "Labour % >35%: Total wages and holiday pay as a % of Revenue ex VAT. Sustained pressure above 35% erodes profitability.",
      })
    }

    if (grossMarginPct < 0.6) {
      signals.push({
        text: "Gross margin is softer than expected. Review food cost, supplier pricing and waste.",
        tooltip:
          "Gross Margin <60%: Gross Profit ÷ Revenue × 100. Below 60% signals food cost pressure — review supplier pricing and waste.",
      })
    }

    return signals
  }, [netMarginPct, labourPct, grossMarginPct])

  async function reloadBreakdown() {
    try {
      const [breakdownData, updatedReport] = await Promise.all([
        getWeeklyReportBreakdown(reportId),
        getWeeklyReportById(reportId),
      ])

      setBreakdown(breakdownData)
      setReport(updatedReport)

      setForm((prev) => ({
        ...prev,
        sales_inc_vat: updatedReport.sales_inc_vat || 0,
        sales_ex_vat: updatedReport.sales_ex_vat || 0,
        wages: updatedReport.wages || 0,
        holiday_pay: updatedReport.holiday_pay || 0,
        food_cost: updatedReport.food_cost || 0,
        fixed_costs: updatedReport.fixed_costs || 0,
        variable_costs: updatedReport.variable_costs || 0,
        loans_hp: updatedReport.loans_hp || 0,
        vat_due: updatedReport.vat_due || 0,
        notes: updatedReport.notes || "",
      }))

      if ((updatedReport.food_cost || 0) > 0 && (updatedReport.sales_ex_vat || 0) > 0) {
        const pct = ((updatedReport.food_cost || 0) / (updatedReport.sales_ex_vat || 1)) * 100
        setFoodCostPercent(pct.toFixed(2))
      }
    } catch (err) {
      console.error("Reload breakdown error:", err)
    }
  }

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  const clearSavedJustNowTimer = useCallback(() => {
    if (savedJustNowTimerRef.current !== null) {
      window.clearTimeout(savedJustNowTimerRef.current)
      savedJustNowTimerRef.current = null
    }
  }, [])

  function getSaveButtonLabel() {
    if (saving) return "Saving..."
    if (saveError) return "Retry save"
    if (hasUnsavedChanges) return "Save now"
    return "Save now"
  }

  const saveReportSilently = useCallback(async (): Promise<WeeklyReportDetail> => {
    if (saveInFlightRef.current && savePromiseRef.current) {
      return savePromiseRef.current
    }

    const payload = currentPayloadRef.current || currentPayload
    const signature = buildSaveSignature(payload)

    if (signature === lastSavedSignatureRef.current && report) {
      return report
    }

    clearAutosaveTimer()
    clearSavedJustNowTimer()

    saveInFlightRef.current = true
    setSaving(true)

    const request = updateWeeklyReport(reportId, payload)
    savePromiseRef.current = request

    try {
      const updated = await request

      setReport(updated)
      setForm({
        company_id: updated.company_id,
        week_ending: formatDateInput(updated.week_ending),
        sales_inc_vat: updated.sales_inc_vat || 0,
        sales_ex_vat: updated.sales_ex_vat || 0,
        wages: updated.wages || 0,
        holiday_pay: updated.holiday_pay || 0,
        food_cost: updated.food_cost || 0,
        fixed_costs: updated.fixed_costs || 0,
        variable_costs: updated.variable_costs || 0,
        loans_hp: updated.loans_hp || 0,
        vat_due: updated.vat_due || 0,
        notes: updated.notes || "",
      })

      if ((updated.food_cost || 0) > 0 && (updated.sales_ex_vat || 0) > 0) {
        const pct = ((updated.food_cost || 0) / (updated.sales_ex_vat || 1)) * 100
        setFoodCostPercent(pct.toFixed(2))
      }

      const updatedPayload: WeeklyReportUpdatePayload = {
        company_id: updated.company_id,
        week_ending: formatDateInput(normalizeWeekEndingToSunday(updated.week_ending)),
        sales_inc_vat: updated.sales_inc_vat || 0,
        sales_ex_vat: updated.sales_ex_vat || 0,
        wages: updated.wages || 0,
        holiday_pay: updated.holiday_pay || 0,
        food_cost: updated.food_cost || 0,
        fixed_costs: updated.fixed_costs || 0,
        variable_costs: updated.variable_costs || 0,
        loans_hp: updated.loans_hp || 0,
        vat_due: updated.vat_due || 0,
        notes: updated.notes || "",
      }
      const updatedSignature = buildSaveSignature(updatedPayload)
      setLastSavedSignature(updatedSignature)
      lastSavedSignatureRef.current = updatedSignature
      currentSignatureRef.current = updatedSignature
      currentPayloadRef.current = updatedPayload
      setSaveError(null)
      setSavedJustNow(true)
      clearSavedJustNowTimer()
      savedJustNowTimerRef.current = window.setTimeout(() => {
        setSavedJustNow(false)
      }, 2200)

      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update weekly report."
      console.error("Save report error:", err)
      setSaveError(message)
      setError(message)
      throw err
    } finally {
      saveInFlightRef.current = false
      savePromiseRef.current = null
      setSaving(false)
    }
  }, [
    clearAutosaveTimer,
    clearSavedJustNowTimer,
    currentPayload,
    report,
    reportId,
  ])

  const flushPendingChanges = useCallback(async (): Promise<WeeklyReportDetail> => {
    clearAutosaveTimer()

    let latestReport = report

    while (currentSignatureRef.current !== lastSavedSignatureRef.current) {
      latestReport = await saveReportSilently()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    if (!latestReport) {
      throw new Error("No weekly report is loaded.")
    }

    return latestReport
  }, [clearAutosaveTimer, currentSignatureRef, lastSavedSignatureRef, report, saveReportSilently])

  useEffect(() => {
    if (loading || !report) return

    if (!hasUnsavedChanges) {
      clearAutosaveTimer()
      return
    }

    if (saveError) {
      clearAutosaveTimer()
      return
    }

    clearAutosaveTimer()
    autosaveTimerRef.current = window.setTimeout(() => {
      void flushPendingChanges().catch((err) => {
        console.error("Autosave error:", err)
      })
    }, 1000)

    return clearAutosaveTimer
  }, [clearAutosaveTimer, currentSignature, flushPendingChanges, hasUnsavedChanges, loading, report, saveError])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (loading) return

      if (saving || hasUnsavedChanges || saveError) {
        event.preventDefault()
        event.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges, loading, saveError, saving])

  useEffect(() => {
    return () => {
      clearAutosaveTimer()
      clearSavedJustNowTimer()
    }
  }, [clearAutosaveTimer, clearSavedJustNowTimer])

  async function handleSave() {
    try {
      setError(null)
      setSuccessMessage(null)
      setSaveError(null)

      await flushPendingChanges()
      await reloadBreakdown()

      setSuccessMessage("Weekly report updated successfully.")
    } catch (err) {
      console.error("Save report error:", err)
      setError(err instanceof Error ? err.message : "Failed to update weekly report.")
    }
  }

  async function generateAndDownloadPdf() {
    const { jsPDF } = await import("jspdf")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 18
    const contentW = pageW - margin * 2
    let y = 0

    const c = {
      dark: [9, 9, 11] as [number, number, number],
      slate50: [248, 250, 252] as [number, number, number],
      zinc600: [82, 82, 91] as [number, number, number],
      zinc500: [113, 113, 122] as [number, number, number],
      zinc300: [212, 212, 216] as [number, number, number],
      zinc200: [228, 228, 231] as [number, number, number],
      zinc100: [244, 244, 245] as [number, number, number],
      zinc50: [250, 250, 250] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      emerald: [16, 185, 129] as [number, number, number],
      emeraldBg: [209, 250, 229] as [number, number, number],
      emeraldText: [6, 95, 70] as [number, number, number],
      amber: [245, 158, 11] as [number, number, number],
      amberBg: [254, 243, 199] as [number, number, number],
      amberText: [120, 53, 15] as [number, number, number],
      rose: [244, 63, 94] as [number, number, number],
      blue: [37, 99, 235] as [number, number, number],
      blueBg: [239, 246, 255] as [number, number, number],
      blueText: [29, 78, 216] as [number, number, number],
    }

    function needsNewPage(space: number) {
      if (y + space > pageH - margin) {
        doc.addPage()
        y = margin + 8
      }
    }

    // ── HEADER ────────────────────────────────────────────────────
    const genDate = `Generated ${new Date().toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`
    const weekLabel = buildWeekLabel(report)
    const weekRange =
      report?.week_start && report?.week_end
        ? `${formatDate(report.week_start)} → ${formatDate(report.week_end)}`
        : report?.week_ending
          ? formatDate(report.week_ending)
          : "-"
    const companyName = report?.company_name || "Company"

    doc.setFillColor(...c.slate50)
    doc.rect(0, 0, pageW, 48, "F")
    doc.setFillColor(...c.blue)
    doc.rect(0, 0, pageW, 1.5, "F")
    doc.setDrawColor(...c.zinc200)
    doc.line(margin, 48, pageW - margin, 48)

    // Brand mark and wordmark
    const logoX = margin
    const logoY = 9
    doc.setFillColor(...c.dark)
    doc.roundedRect(logoX, logoY + 0.25, 8.8, 8.8, 2.2, 2.2, "F")
    doc.setFillColor(...c.blue)
    doc.roundedRect(logoX + 1.35, logoY + 4.95, 1.45, 2.35, 0.55, 0.55, "F")
    doc.roundedRect(logoX + 3.55, logoY + 2.95, 1.45, 4.35, 0.55, 0.55, "F")
    doc.roundedRect(logoX + 5.75, logoY + 1.15, 1.45, 6.15, 0.55, 0.55, "F")
    doc.setDrawColor(...c.blue)
    doc.setLineWidth(0.7)
    doc.line(logoX + 1.15, logoY + 7.15, logoX + 7.85, logoY + 2.45)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...c.dark)
    doc.text("Margin", logoX + 12.8, logoY + 5.9)
    doc.setTextColor(...c.blueText)
    doc.text("Flow", logoX + 32.0, logoY + 5.9)

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...c.zinc500)
    doc.text("Weekly Intelligence Report", logoX, logoY + 13.2)

    // Company name and meta chips
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...c.dark)
    doc.text(companyName, margin, 26.6)

    const chipY = 31.2
    const chipH = 7.5
    const chipGap = 2.2
    const chips = [
      { text: weekLabel, fill: c.blueBg, textColor: c.blueText },
      { text: weekRange, fill: c.zinc100, textColor: c.zinc600 },
    ]
    let chipX = margin
    chips.forEach((chip) => {
      const chipW = doc.getTextWidth(chip.text) + 8.5
      doc.setFillColor(...chip.fill)
      doc.roundedRect(chipX, chipY, chipW, chipH, 2.5, 2.5, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...chip.textColor)
      doc.text(chip.text, chipX + chipW / 2, chipY + 5.0, { align: "center" })
      chipX += chipW + chipGap
    })

    // Healthy badge and generated date on the right
    const badgeText = healthLabel
    const badgeW = doc.getTextWidth(badgeText) + 10
    const badgeX = pageW - margin - badgeW
    const badgeBg =
      netMarginPct >= 0.18 && labourPct <= 0.32 ? c.emeraldBg : netMarginPct >= 0.1 ? c.amberBg : c.rose
    const badgeFg =
      netMarginPct >= 0.18 && labourPct <= 0.32 ? c.emeraldText : netMarginPct >= 0.1 ? c.amberText : c.white
    doc.setFillColor(...badgeBg)
    doc.roundedRect(badgeX, logoY + 0.2, badgeW, 7.8, 2.6, 2.6, "F")
    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...badgeFg)
    doc.text(badgeText, badgeX + badgeW / 2, logoY + 5.2, { align: "center" })

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...c.zinc500)
    const genW = doc.getTextWidth(genDate)
    doc.text(genDate, pageW - margin - genW, logoY + 14)

    y = 58

    // ── KPI CARDS ─────────────────────────────────────────────────
    const kpiItems = [
      { label: "Sales ex VAT", value: formatMoney(salesExVat), sub: "Core revenue base", color: c.dark },
      {
        label: "Net Profit",
        value: formatMoney(netProfit),
        sub: "Bottom-line result",
        color: netProfit > 0 ? c.emerald : c.rose,
      },
      {
        label: "Net Margin",
        value: formatPct(netMarginPct),
        sub: "Profitability quality",
        color: netMarginPct >= 0.18 ? c.emerald : netMarginPct >= 0.1 ? c.amber : c.rose,
      },
      {
        label: "Labour %",
        value: formatPct(labourPct),
        sub: "Pressure vs revenue",
        color: labourPct > 0.35 ? c.rose : labourPct > 0.25 ? c.amber : c.dark,
      },
    ]

    const kpiW = (contentW - 9) / 4
    kpiItems.forEach((kpi, i) => {
      const kx = margin + i * (kpiW + 3)
      doc.setFillColor(...c.white)
      doc.setDrawColor(...c.zinc200)
      doc.roundedRect(kx, y, kpiW, 30, 3, 3, "FD")
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc500)
      doc.text(kpi.label, kx + 4, y + 9)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...kpi.color)
      doc.text(kpi.value, kx + 4, y + 19)
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc500)
      doc.text(kpi.sub, kx + 4, y + 26)
    })

    y += 40

    // ── MARGIN SNAPSHOT ───────────────────────────────────────────
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...c.dark)
    doc.text("Margin Snapshot", margin, y)
    y += 8

    const snapshotRows: Array<{ label: string; value: string; color?: [number, number, number] }> = [
      { label: "Sales ex VAT", value: formatMoney(salesExVat) },
      { label: "Gross Profit", value: formatMoney(grossProfit), color: grossProfit > 0 ? c.emerald : c.rose },
      { label: "Gross Margin %", value: formatPct(grossMarginPct) },
      { label: "Labour Total", value: formatMoney(labourTotal) },
      { label: "Labour %", value: formatPct(labourPct), color: labourPct > 0.25 ? c.amber : undefined },
      { label: "Net Profit", value: formatMoney(netProfit), color: netProfit > 0 ? c.emerald : c.rose },
      { label: "Net Margin %", value: formatPct(netMarginPct), color: netMarginPct >= 0.18 ? c.emerald : undefined },
      { label: "Food Cost", value: formatMoney(computedFoodCost) },
      { label: "Fixed Costs", value: formatMoney(Number(form.fixed_costs)) },
      { label: "Variable Costs", value: formatMoney(Number(form.variable_costs)) },
    ]

    snapshotRows.forEach((row, i) => {
      needsNewPage(9)
      if (i % 2 === 0) {
        doc.setFillColor(...c.zinc50)
        doc.rect(margin, y, contentW, 8.5, "F")
      }
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc500)
      doc.text(row.label, margin + 4, y + 5.8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...(row.color ?? c.dark))
      const vw = doc.getTextWidth(row.value)
      doc.text(row.value, margin + contentW - 4 - vw, y + 5.8)
      y += 8.5
    })

    doc.setDrawColor(...c.zinc200)
    doc.line(margin, y, margin + contentW, y)
    y += 10

    // ── KEY SIGNALS ───────────────────────────────────────────────
    if (goodSignals.length > 0 || warningSignals.length > 0) {
      needsNewPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...c.dark)
      doc.text("Key Signals", margin, y)
      y += 8

      for (const signal of goodSignals) {
        const lines = doc.splitTextToSize(signal.text, contentW - 10)
        const boxH = lines.length * 5.5 + 8
        needsNewPage(boxH + 4)
        doc.setFillColor(...c.emeraldBg)
        doc.setDrawColor(167, 243, 208)
        doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD")
        doc.setFontSize(8.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...c.emeraldText)
        doc.text(lines, margin + 5, y + 7)
        y += boxH + 4
      }

      for (const signal of warningSignals) {
        const lines = doc.splitTextToSize(signal.text, contentW - 10)
        const boxH = lines.length * 5.5 + 8
        needsNewPage(boxH + 4)
        doc.setFillColor(...c.amberBg)
        doc.setDrawColor(253, 230, 138)
        doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD")
        doc.setFontSize(8.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...c.amberText)
        doc.text(lines, margin + 5, y + 7)
        y += boxH + 4
      }

      y += 4
    }

    // ── NOTES ─────────────────────────────────────────────────────
    if (form.notes) {
      needsNewPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...c.dark)
      doc.text("Notes", margin, y)
      y += 8

      const noteLines = doc.splitTextToSize(form.notes, contentW - 10)
      const noteH = noteLines.length * 5.5 + 10
      needsNewPage(noteH)
      doc.setFillColor(...c.zinc50)
      doc.setDrawColor(...c.zinc200)
      doc.roundedRect(margin, y, contentW, noteH, 2, 2, "FD")
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc600)
      doc.text(noteLines, margin + 5, y + 8)
      y += noteH + 10
    }

    // ── GLOSSARY PAGE ─────────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(...c.dark)
    doc.rect(0, 0, pageW, 28, "F")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...c.white)
    doc.text("Metrics Glossary", margin, 18)

    y = 38

    const glossaryItems = [
      {
        term: "Revenue / Sales ex VAT",
        def: "Total gross revenue generated in the period, excluding VAT. The starting point for all profitability calculations.",
      },
      {
        term: "Gross Profit",
        def: "Revenue minus Cost of Goods Sold (food cost and direct product costs). Measures how efficiently sales convert into profit before labour and overhead.",
      },
      {
        term: "Gross Margin %",
        def: "Gross Profit ÷ Revenue × 100. A gross margin above 65% is considered healthy for a café or bakery operation.",
      },
      {
        term: "Net Profit",
        def: "The bottom-line result after all costs: food, labour, fixed costs, variable costs, loans, and VAT due.",
      },
      {
        term: "Net Margin %",
        def: "Net Profit ÷ Revenue × 100. Target 18%+ for a healthy and well-managed operation.",
      },
      {
        term: "Labour %",
        def: "Total labour cost (wages + holiday pay) as a percentage of Revenue ex VAT. Keep under 32% for a balanced cost structure.",
      },
      {
        term: "Food Cost",
        def: "Direct cost of ingredients and consumables used to produce the goods sold. Typically expressed as a percentage of Revenue ex VAT.",
      },
      {
        term: "Fixed Costs",
        def: "Recurring costs that remain constant regardless of revenue levels — rent, insurance, utilities.",
      },
      {
        term: "Variable Costs",
        def: "Costs that fluctuate with operational activity — packaging, cleaning supplies, and other day-to-day operational expenses.",
      },
      {
        term: "AOV (Average Order Value)",
        def: "Average revenue per transaction: Total Revenue ÷ Number of Transactions. A rising AOV signals effective upselling or pricing strength.",
      },
      {
        term: "VAT Due",
        def: "Value Added Tax payable to the revenue authority for the period. Deducted in the net profit calculation as it represents a cash liability.",
      },
      {
        term: "Profit",
        def: "Interchangeable with Net Profit in this platform. Represents the true residual value after all business costs have been deducted from revenue.",
      },
    ]

    glossaryItems.forEach((item, i) => {
      const defLines = doc.splitTextToSize(item.def, contentW - 8)
      const rowH = defLines.length * 5 + 17
      needsNewPage(rowH + 3)

      if (i % 2 === 0) {
        doc.setFillColor(...c.zinc50)
        doc.rect(margin, y, contentW, rowH, "F")
      }

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...c.dark)
      doc.text(item.term, margin + 4, y + 9)

      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc500)
      doc.text(defLines, margin + 4, y + 15)

      y += rowH + 3
    })

    // ── PAGE FOOTERS ──────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...c.zinc500)
      doc.setDrawColor(...c.zinc200)
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
      doc.text("MarginFlow — Confidential Weekly Report", margin, pageH - 7)
      const pLabel = `Page ${p} of ${totalPages}`
      doc.text(pLabel, pageW - margin - doc.getTextWidth(pLabel), pageH - 7)
    }

    const company = (report?.company_name || "weekly").toLowerCase().replace(/\s+/g, "-")
    const week = report?.week_ending || "week"
    doc.save(`marginflow-report-${company}-${week}.pdf`)
  }

  async function handleGeneratePdf() {
    try {
      setBusyAction("pdf")
      setError(null)
      setSuccessMessage(null)
      setSaveError(null)

      await flushPendingChanges()
      await reloadBreakdown()
      await generateAndDownloadPdf()

      setSuccessMessage("PDF downloaded successfully.")
    } catch (err) {
      console.error("Generate PDF error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate PDF.")
    } finally {
      setBusyAction(null)
    }
  }

  function handleSendEmail() {
    setEmailModalOpen(true)
  }

  async function handleConfirmSendEmail() {
    if (!emailTo || !emailTo.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    try {
      setSendingEmail(true)
      setError(null)
      setSaveError(null)

      await flushPendingChanges()
      await reloadBreakdown()

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          reportData: {
            companyName: report?.company_name || "Company",
            weekLabel: buildWeekLabel(report),
            weekStart: formatDate(report?.week_start),
            weekEnd: formatDate(report?.week_end),
            salesExVat: formatMoney(salesExVat),
            netProfit: formatMoney(netProfit),
            netMarginPct: formatPct(netMarginPct),
            grossProfit: formatMoney(grossProfit),
            grossMarginPct: formatPct(grossMarginPct),
            labourTotal: formatMoney(labourTotal),
            labourPct: formatPct(labourPct),
            healthLabel,
            netMarginRaw: netMarginPct,
            labourRaw: labourPct,
            netProfitRaw: netProfit,
            goodSignals: goodSignals.map((s) => s.text),
            warningSignals: warningSignals.map((s) => s.text),
            notes: form.notes || "",
          },
        }),
      })

      const data = (await response.json()) as { success: boolean; message?: string }

      if (!data.success) {
        throw new Error(data.message || "Failed to send email.")
      }

      setEmailModalOpen(false)
      setEmailTo("")
      setSuccessMessage(`Report sent to ${emailTo} successfully.`)
    } catch (err) {
      console.error("Send email error:", err)
      setError(err instanceof Error ? err.message : "Failed to send weekly report email.")
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleAddBreakdownItem() {
    try {
      setAddingItem(true)
      setError(null)
      setSuccessMessage(null)

      if (!newItem.category_id) {
        throw new Error("Select a category.")
      }

      const amount = Number(newItem.amount)
      if (!amount || amount <= 0) {
        throw new Error("Enter a valid amount greater than zero.")
      }

      await createWeeklyReportItem(reportId, {
        category_id: newItem.category_id,
        amount,
        notes: newItem.notes || null,
      })

      setNewItem({
        category_id: "",
        amount: "",
        notes: "",
      })

      await reloadBreakdown()
      setSuccessMessage(
        "Breakdown item added successfully. Core mapped fields were updated where applicable."
      )
    } catch (err) {
      console.error("Add breakdown item error:", err)
      setError(err instanceof Error ? err.message : "Failed to add breakdown item.")
    } finally {
      setAddingItem(false)
    }
  }

  async function handleDeleteBreakdownItem(itemId: string) {
    try {
      setDeletingItemId(itemId)
      setError(null)
      setSuccessMessage(null)

      await deleteWeeklyReportItem(itemId)
      await reloadBreakdown()
      setSuccessMessage("Breakdown item deleted successfully. Core mapped fields were recalculated.")
    } catch (err) {
      console.error("Delete breakdown item error:", err)
      setError(err instanceof Error ? err.message : "Failed to delete breakdown item.")
    } finally {
      setDeletingItemId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1440px]">
          <SectionCard title="Loading report" description="Fetching weekly intelligence data.">
            <p className="text-sm text-zinc-500">Loading weekly report...</p>
          </SectionCard>
        </div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
            Weekly report not found.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {emailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!sendingEmail) {
                setEmailModalOpen(false)
                setEmailTo("")
              }
            }}
          />

          <div className="relative w-full max-w-md rounded-[30px] border border-black/5 bg-white/98 p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                <Mail size={20} />
              </div>

              <div className="flex-1">
                <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-zinc-950">
                  Send by Email
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Enter the recipient&apos;s email address to send the weekly intelligence report.
                </p>
              </div>

              <button
                onClick={() => {
                  if (!sendingEmail) {
                    setEmailModalOpen(false)
                    setEmailTo("")
                  }
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-medium text-zinc-500">Report</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {report.company_name} · {buildWeekLabel(report)}
              </p>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Recipient Email
              </label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sendingEmail) handleConfirmSendEmail()
                }}
                placeholder="e.g. owner@company.com"
                autoFocus
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmSendEmail}
                disabled={sendingEmail || !emailTo}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={15} />
                {sendingEmail ? "Sending..." : "Send Report"}
              </button>

              <button
                onClick={() => {
                  if (!sendingEmail) {
                    setEmailModalOpen(false)
                    setEmailTo("")
                  }
                }}
                disabled={sendingEmail}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/companies/${companyId}/reports`}
            onClick={(e) => {
              if (saving || hasUnsavedChanges || saveError) {
                const ok = window.confirm(
                  "You have unsaved changes or a save is still in progress. Leave this page anyway?"
                )
                if (!ok) {
                  e.preventDefault()
                }
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <ArrowLeft size={16} />
            Back to Weekly Reports
          </Link>
        </div>

        <section className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Weekly report detail
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                  <Building2 size={20} />
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-zinc-950 md:text-[2.35rem]">
                      Weekly Intelligence Report
                    </h1>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                        healthBadgeClass
                      )}
                    >
                      {healthLabel}
                    </span>
                  </div>

                  <p className="max-w-3xl text-sm leading-6 text-zinc-500">
                    Review, edit, and distribute the company&apos;s weekly performance pack.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                  Week ending {formatDate(report.week_ending)}
                </span>
                {isoWeekInfo ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600">
                    ISO Week {isoWeekInfo.isoWeek} · {isoWeekInfo.isoYear}
                  </span>
                ) : null}
                {isoWeekInfo ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600">
                    {formatDateLong(isoWeekInfo.start)}{" \u2192 "}{formatDateLong(isoWeekInfo.end)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <button
                onClick={handleGeneratePdf}
                disabled={busyAction !== null || saving}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {busyAction === "pdf" ? "Generating..." : "Generate PDF"}
              </button>

              <button
                onClick={handleSendEmail}
                disabled={busyAction !== null || saving}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={16} />
                {busyAction === "email" ? "Sending..." : "Send by Email"}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            {successMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KPI
            icon={<Wallet size={18} />}
            label="Sales ex VAT"
            value={formatMoney(form.sales_ex_vat)}
            caption="Core revenue base"
            tooltip="Total gross revenue generated in the period, excluding VAT. The starting point for all profitability calculations."
          />
          <KPI
            icon={<TrendingUp size={18} />}
            label="Net Profit"
            value={formatMoney(netProfit)}
            caption="Bottom-line result"
            tone={netProfit > 0 ? "success" : "default"}
            tooltip="The bottom-line result after all costs: food, labour, fixed costs, variable costs, loans, and VAT due."
          />
          <KPI
            icon={<Percent size={18} />}
            label="Net Margin"
            value={formatPct(netMarginPct)}
            caption="Profitability quality"
            tone={netMarginPct >= 0.18 ? "success" : "default"}
            tooltip="Net Profit ÷ Revenue × 100. Target 18%+ for a healthy, well-managed operation."
          />
          <KPI
            icon={<Settings2 size={18} />}
            label="Labour %"
            value={formatPct(labourPct)}
            caption="Pressure vs revenue"
            tone={labourPct > 0.25 ? "warning" : "default"}
            tooltip="Total wages and holiday pay as a percentage of Revenue ex VAT. Keep under 32% for a balanced cost structure."
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <SectionCard
              title="Core Report"
              description="Keep the weekly report clean and operational. Use this as the main financial layer for the week."
              icon={<ReceiptText size={18} />}
            >
              <div className="space-y-4">
                <SubCard title="A. Week Setup" icon={<CalendarDays size={15} />}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="Week Ending"
                      type="date"
                      value={form.week_ending}
                      onChange={(value) => setForm((prev) => ({ ...prev, week_ending: value }))}
                    />

                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        ISO Week
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-950">
                        {isoWeekInfo ? `Week ${isoWeekInfo.isoWeek} · ${isoWeekInfo.isoYear}` : "Select a date"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {isoWeekInfo
                          ? `${formatDateLong(isoWeekInfo.start)} \u2192 ${formatDateLong(isoWeekInfo.end)}`
                          : "The calendar week range will appear here."}
                      </p>
                    </div>
                  </div>
                </SubCard>

                <SubCard title="B. Revenue" icon={<Wallet size={15} />}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MoneyField
                      label="Sales inc VAT"
                      value={String(form.sales_inc_vat)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, sales_inc_vat: Number(value) || 0 }))
                      }
                    />

                    <MoneyField
                      label="Sales ex VAT"
                      value={String(form.sales_ex_vat)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, sales_ex_vat: Number(value) || 0 }))
                      }
                    />
                  </div>
                </SubCard>

                <SubCard title="C. Costs" icon={<Settings2 size={15} />}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MoneyField
                      label="Wages"
                      value={String(form.wages)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, wages: Number(value) || 0 }))
                      }
                    />

                    <MoneyField
                      label="Holiday Pay"
                      value={String(form.holiday_pay)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, holiday_pay: Number(value) || 0 }))
                      }
                    />

                    <div className="md:col-span-2 rounded-3xl border border-zinc-200 bg-white p-4 md:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-950">Food Cost</p>
                          <p className="text-sm leading-6 text-zinc-500">
                            Enter a manual amount or calculate it as a percentage of sales.
                          </p>
                        </div>

                        <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1">
                          <button
                            type="button"
                            onClick={() => setFoodCostMode("manual")}
                            className={cn(
                              "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition",
                              foodCostMode === "manual"
                                ? "bg-zinc-950 text-white shadow-sm"
                                : "text-zinc-600 hover:text-zinc-950"
                            )}
                          >
                            Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => setFoodCostMode("percent")}
                            className={cn(
                              "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition",
                              foodCostMode === "percent"
                                ? "bg-zinc-950 text-white shadow-sm"
                                : "text-zinc-600 hover:text-zinc-950"
                            )}
                          >
                            % of Sales
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {foodCostMode === "manual" ? (
                          <MoneyField
                            label="Food Cost"
                            value={String(form.food_cost)}
                            onChange={(value) =>
                              setForm((prev) => ({ ...prev, food_cost: Number(value) || 0 }))
                            }
                          />
                        ) : (
                          <>
                            <PercentField
                              label="Food Cost %"
                              value={foodCostPercent}
                              onChange={setFoodCostPercent}
                            />
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3.5">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                Calculated Food Cost
                              </p>
                              <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                                {formatMoney(computedFoodCost)}
                              </p>
                              <p className="mt-1 text-sm text-zinc-500">
                                Updates live from the percentage of sales.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <MoneyField
                      label="Fixed Costs"
                      value={String(form.fixed_costs)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, fixed_costs: Number(value) || 0 }))
                      }
                    />

                    <MoneyField
                      label="Variable Costs"
                      value={String(form.variable_costs)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, variable_costs: Number(value) || 0 }))
                      }
                    />

                    <MoneyField
                      label="Loans / HP"
                      value={String(form.loans_hp)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, loans_hp: Number(value) || 0 }))
                      }
                    />

                    <MoneyField
                      label="VAT Due"
                      value={String(form.vat_due)}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, vat_due: Number(value) || 0 }))
                      }
                    />
                  </div>
                </SubCard>

                <SubCard title="D. Notes" icon={<ReceiptText size={15} />}>
                  <textarea
                    rows={5}
                    value={form.notes || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="h-32 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                    placeholder="Weekly notes, anomalies, events or operational observations..."
                  />
                </SubCard>
              </div>
            </SectionCard>

            <SectionCard
              title="P&L Breakdown"
              description="Categorized financial lines for a cleaner, more scalable weekly structure."
              icon={<Layers3 size={18} />}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="relative rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 shadow-sm">
                  <div className="absolute right-3 top-3">
                    <TooltipIcon definition="Number of categorized P&L entries attached to this report. More lines = more detailed financial visibility." />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Breakdown Lines
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-950">
                    {breakdownLineCount}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">Categorized entries in this report</p>
                </div>

                <div className="relative rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 shadow-sm">
                  <div className="absolute right-3 top-3">
                    <TooltipIcon definition="Sum of all categorized P&L line items in this report. Compare against the core report totals to check reconciliation." />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Breakdown Total
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-950">
                    {formatMoney(breakdownTotal)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">Sum of all categorized lines</p>
                </div>

                <div className="relative rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 shadow-sm">
                  <div className="absolute right-3 top-3">
                    <TooltipIcon definition="The highest-value categorized P&L line item in this report — the single largest cost or revenue driver." />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Top Line
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                    {topBreakdownItem?.category_name || "No items yet"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {topBreakdownItem
                      ? formatMoney(topBreakdownItem.amount)
                      : "Largest categorized amount"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 md:p-5">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-zinc-950">Add Breakdown Item</h4>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    Use mapped categories like Wages, Holiday Pay and Food Purchases to feed the
                    main report automatically.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-8">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Category
                    </label>
                    <select
                      value={newItem.category_id}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, category_id: e.target.value }))
                      }
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.type}
                          {category.group ? ` • ${category.group}` : ""})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <MoneyField
                      label="Amount"
                      value={newItem.amount}
                      onChange={(value) => setNewItem((prev) => ({ ...prev, amount: value }))}
                    />
                  </div>

                  <div className="md:col-span-12">
                    <Field
                      label="Notes"
                      value={newItem.notes}
                      onChange={(value) => setNewItem((prev) => ({ ...prev, notes: value }))}
                      placeholder="Optional note for this line"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddBreakdownItem}
                    disabled={addingItem}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={16} />
                    {addingItem ? "Adding..." : "Add Breakdown Item"}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {!breakdown || breakdown.items.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-sm text-zinc-500 shadow-sm">
                    <p className="font-medium text-zinc-700">No breakdown items added yet.</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Add categorized lines to standardize this weekly report.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50/90 text-left text-zinc-500">
                        <tr>
                          <th className="px-4 py-4 font-medium">Category</th>
                          <th className="px-4 py-4 font-medium">Type</th>
                          <th className="px-4 py-4 font-medium">Group</th>
                          <th className="px-4 py-4 font-medium">Amount</th>
                          <th className="px-4 py-4 font-medium">Notes</th>
                          <th className="px-4 py-4 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(breakdown?.items || [])]
                          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
                          .map((item) => (
                            <tr
                              key={item.id}
                              className="border-t border-zinc-100 bg-white transition hover:bg-zinc-50/70"
                            >
                              <td className="px-4 py-4 font-medium text-zinc-950">
                                {item.category_name}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                                    getTypePillClass(item.category_type)
                                  )}
                                >
                                  {item.category_type}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                                    getGroupPillClass(item.category_group)
                                  )}
                                >
                                  {item.category_group || "Ungrouped"}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-semibold text-zinc-950">
                                {formatMoney(item.amount)}
                              </td>
                              <td className="px-4 py-4 text-zinc-600">{item.notes || "-"}</td>
                              <td className="px-4 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBreakdownItem(item.id)}
                                  disabled={deletingItemId === item.id}
                                  className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Trash2 size={14} />
                                  {deletingItemId === item.id ? "Deleting..." : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4 xl:col-span-4 xl:sticky xl:top-6 self-start">
            <div className="rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Save status
                  </p>
                  <div
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                      getSaveToneClass(saveStatus.tone)
                    )}
                  >
                    <span className="flex items-center">{saveStatus.icon}</span>
                    <span>{saveStatus.label}</span>
                  </div>
                  <p className="text-sm leading-6 text-zinc-500">{saveStatus.helper}</p>
                  {saveError && hasUnsavedChanges ? (
                    <p className="text-sm leading-6 text-rose-600">{saveError}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || busyAction !== null}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-medium shadow-sm transition",
                    saving
                      ? "cursor-not-allowed border border-zinc-200 bg-zinc-50 text-zinc-400"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  )}
                >
                  <Save size={16} />
                  {getSaveButtonLabel()}
                </button>
              </div>
            </div>

            <SectionCard
              title="Live Margin Snapshot"
              description="The financial story of this week, at a glance. Updates as you edit."
              icon={<Target size={18} />}
            >
              <div className="space-y-3">
                <ExecutiveRow
                  label="Sales ex VAT"
                  value={formatMoney(salesExVat)}
                  tooltip="Total gross revenue excluding VAT. The baseline for all profitability calculations."
                />
                <ExecutiveRow
                  label="Gross Profit"
                  value={formatMoney(grossProfit)}
                  valueClassName={grossProfit > 0 ? "text-emerald-600" : "text-rose-600"}
                  tooltip="Revenue minus Cost of Goods Sold (food cost). Measures efficiency before labour and overhead."
                />
                <ExecutiveRow
                  label="Gross Margin"
                  value={formatPct(grossMarginPct)}
                  tooltip="Gross Profit ÷ Revenue × 100. Above 65% is considered healthy for a café or bakery operation."
                />
                <ExecutiveRow
                  label="Labour Total"
                  value={formatMoney(labourTotal)}
                  tooltip="Total wages and holiday pay for the period — the combined direct labour cost."
                />
                <ExecutiveRow
                  label="Labour %"
                  value={formatPct(labourPct)}
                  valueClassName={labourPct > 0.25 ? "text-amber-600" : ""}
                  tooltip="Labour Total as a % of Revenue ex VAT. Keep under 32% for a balanced cost structure."
                />
                <ExecutiveRow
                  label="Net Profit"
                  value={formatMoney(netProfit)}
                  valueClassName={netProfit > 0 ? "text-emerald-600" : "text-rose-600"}
                  tooltip="The bottom-line result after all costs: food, labour, fixed costs, variable costs, loans, and VAT due."
                />
                <ExecutiveRow
                  label="Net Margin"
                  value={formatPct(netMarginPct)}
                  valueClassName={netMarginPct >= 0.18 ? "text-emerald-600" : ""}
                  tooltip="Net Profit ÷ Revenue × 100. Target 18%+ for a healthy, well-managed operation."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Key Signals"
              description="What matters most in this week."
              icon={<Sparkles size={18} />}
            >
              <div className="space-y-3">
                {goodSignals.map((signal, index) => (
                  <Signal key={`good-${index}`} tone="good" tooltip={signal.tooltip}>
                    {signal.text}
                  </Signal>
                ))}

                {warningSignals.map((signal, index) => (
                  <Signal key={`warn-${index}`} tone="warn" tooltip={signal.tooltip}>
                    {signal.text}
                  </Signal>
                ))}

                {goodSignals.length === 0 && warningSignals.length === 0 ? (
                  <Signal>Weekly signals will appear as your data becomes richer.</Signal>
                ) : null}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  )
}

