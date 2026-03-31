"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  createWeeklyReportItem,
  deleteWeeklyReportItem,
  generateWeeklyReportPdf,
  getFinancialCategories,
  getWeeklyReportBreakdown,
  getWeeklyReportById,
  sendWeeklyReportEmail,
  updateWeeklyReport,
  type FinancialCategory,
  type WeeklyReportBreakdownResponse,
  type WeeklyReportDetail,
  type WeeklyReportUpdatePayload,
} from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
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
  Wallet,
} from "lucide-react"

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
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function formatDateInput(value?: string | null) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getISOWeekInfo(dateString: string) {
  if (!dateString) return null

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  const monday = new Date(date)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    isoWeek: weekNo,
    isoYear: tmp.getUTCFullYear(),
    start: new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(monday),
    end: new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(sunday),
  }
}

function buildWeekLabel(report: WeeklyReportDetail | null) {
  if (!report) return "Weekly Report"

  if (report.iso_week && report.week_start && report.week_end) {
    const start = new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
    }).format(new Date(report.week_start))

    const end = new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(report.week_end))

    return `ISO ${report.iso_week} • ${start} → ${end}`
  }

  return formatDate(report.week_ending)
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
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
        "rounded-[30px] border border-black/5 bg-white/95 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-sm",
        className
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
            {icon}
          </div>
        ) : null}

        <div>
          <h3 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-zinc-950">
            {title}
          </h3>
          {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
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
    <div className="rounded-[24px] border border-black/5 bg-zinc-50/70 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="mb-4 flex items-center gap-2">
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
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100">
        <span className="mr-2 text-sm text-zinc-500">€</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none disabled:text-zinc-500"
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
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none"
        />
        <span className="ml-2 text-sm text-zinc-500">%</span>
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
}: {
  icon: React.ReactNode
  label: string
  value: string
  caption: string
  tone?: "default" | "success" | "warning"
}) {
  return (
    <div className="rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(15,23,42,0.04)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-4xl font-semibold tracking-tight",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "default" && "text-zinc-950"
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{caption}</p>
    </div>
  )
}

function ExecutiveRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={cn("text-sm font-semibold text-zinc-950", valueClassName)}>{value}</span>
    </div>
  )
}

function Signal({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "good" | "warn"
}) {
  const styles =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-zinc-200 bg-zinc-50 text-zinc-700"

  return <div className={cn("rounded-2xl border px-4 py-3 text-sm leading-6", styles)}>{children}</div>
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
  const [addingItem, setAddingItem] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
      } catch (err) {
        console.error("Report detail error:", err)
        setError(err instanceof Error ? err.message : "Failed to load weekly report.")
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId, companyId])

  const isoWeekInfo = useMemo(() => getISOWeekInfo(form.week_ending), [form.week_ending])

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

  const groupedSummaryRows = useMemo(() => {
    const rows: Array<{ label: string; value: number }> = []

    ;(breakdown?.totals_by_type || []).forEach((row) => {
      rows.push({ label: `Type · ${row.key}`, value: row.total })
    })

    ;(breakdown?.totals_by_group || []).forEach((row) => {
      rows.push({ label: `Group · ${row.key}`, value: row.total })
    })

    return rows
  }, [breakdown])

  const goodSignals = useMemo(() => {
    const signals: string[] = []

    if (netMarginPct >= 0.18) {
      signals.push(
        "Strong week. Profitability is healthy and the business is operating inside a good efficiency range."
      )
    }

    if (grossMarginPct >= 0.65) {
      signals.push("Gross margin is holding well. Core product margin looks solid this week.")
    }

    if (breakdownLineCount > 0) {
      signals.push(
        "Categorized P&L structure is active. Breakdown lines are helping standardize the weekly report."
      )
    }

    return signals
  }, [netMarginPct, grossMarginPct, breakdownLineCount])

  const warningSignals = useMemo(() => {
    const signals: string[] = []

    if (netMarginPct < 0.1) {
      signals.push(
        "Margin is under target. Focus on cost control, pricing discipline and operational efficiency."
      )
    }

    if (labourPct > 0.35) {
      signals.push(
        "Labour pressure is high for the current revenue level. Review rota efficiency and staffing mix."
      )
    }

    if (grossMarginPct < 0.6) {
      signals.push("Gross margin is softer than expected. Review food cost, supplier pricing and waste.")
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

  async function saveReportSilently(): Promise<WeeklyReportDetail> {
    const payload: WeeklyReportUpdatePayload = {
      ...form,
      food_cost: Number(computedFoodCost.toFixed(2)),
    }

    const updated = await updateWeeklyReport(reportId, payload)

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

    return updated
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      await saveReportSilently()
      await reloadBreakdown()

      setSuccessMessage("Weekly report updated successfully.")
    } catch (err) {
      console.error("Save report error:", err)
      setError(err instanceof Error ? err.message : "Failed to update weekly report.")
    } finally {
      setSaving(false)
    }
  }

  async function handleGeneratePdf() {
    try {
      setBusyAction("pdf")
      setError(null)
      setSuccessMessage(null)

      await saveReportSilently()
      await reloadBreakdown()

      const result = await generateWeeklyReportPdf(reportId)

      if (result.download_url) {
        window.open(result.download_url, "_blank", "noopener,noreferrer")
      }

      setSuccessMessage("PDF generated successfully.")
    } catch (err) {
      console.error("Generate PDF error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate PDF.")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSendEmail() {
    try {
      setBusyAction("email")
      setError(null)
      setSuccessMessage(null)

      await saveReportSilently()
      await reloadBreakdown()

      const result = await sendWeeklyReportEmail(reportId)
      setSuccessMessage(result.message || "Weekly report email sent successfully.")
    } catch (err) {
      console.error("Send email error:", err)
      setError(err instanceof Error ? err.message : "Failed to send weekly report email.")
    } finally {
      setBusyAction(null)
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-6 py-8 md:px-8 xl:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionCard title="Loading report" description="Fetching weekly intelligence data.">
            <p className="text-sm text-zinc-500">Loading weekly report...</p>
          </SectionCard>
        </div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-6 py-8 md:px-8 xl:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-red-700">
            Weekly report not found.
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href={`/companies/${companyId}/reports`}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <ArrowLeft size={16} />
                Back to Weekly Reports
              </Link>

              <div className="inline-flex max-w-full items-start gap-4 rounded-[28px] border border-black/5 bg-[linear-gradient(to_bottom,#ffffff,#fafafa)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(15,23,42,0.04)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <Building2 size={20} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-[1.15rem] font-semibold tracking-[-0.02em] text-zinc-950">
                      {report.company_name || "Selected Company"} — Weekly Intelligence Report
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

                  <p className="mt-1 text-base text-zinc-600">{buildWeekLabel(report)}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDate(report.week_start)} → {formatDate(report.week_end)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start">
              <button
                onClick={handleGeneratePdf}
                disabled={busyAction !== null || saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {busyAction === "pdf" ? "Generating..." : "Generate PDF"}
              </button>

              <button
                onClick={handleSendEmail}
                disabled={busyAction !== null || saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={16} />
                {busyAction === "email" ? "Sending..." : "Send by Email"}
              </button>

              <button
                onClick={handleSave}
                disabled={saving || busyAction !== null}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KPI
            icon={<Wallet size={18} />}
            label="Sales ex VAT"
            value={formatMoney(form.sales_ex_vat)}
            caption="Core revenue base"
          />
          <KPI
            icon={<TrendingUp size={18} />}
            label="Net Profit"
            value={formatMoney(netProfit)}
            caption="Bottom-line result"
            tone={netProfit > 0 ? "success" : "default"}
          />
          <KPI
            icon={<Percent size={18} />}
            label="Net Margin"
            value={formatPct(netMarginPct)}
            caption="Profitability quality"
            tone={netMarginPct >= 0.18 ? "success" : "default"}
          />
          <KPI
            icon={<Settings2 size={18} />}
            label="Labour %"
            value={formatPct(labourPct)}
            caption="Pressure vs revenue"
            tone={labourPct > 0.25 ? "warning" : "default"}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.22fr_0.78fr]">
          <div className="space-y-6">
            <SectionCard
              title="Core Report"
              description="Keep the weekly report clean and operational. Use this as the main financial layer for the week."
              icon={<ReceiptText size={18} />}
            >
              <div className="space-y-4">
                <SubCard title="Week Setup" icon={<CalendarDays size={15} />}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="Week Ending"
                      type="date"
                      value={form.week_ending}
                      onChange={(value) => setForm((prev) => ({ ...prev, week_ending: value }))}
                    />

                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-sm font-medium text-zinc-700">ISO Week</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        {isoWeekInfo
                          ? `Week ${isoWeekInfo.isoWeek} / ${isoWeekInfo.isoYear}`
                          : "Select a date"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {isoWeekInfo ? `${isoWeekInfo.start} → ${isoWeekInfo.end}` : ""}
                      </p>
                    </div>
                  </div>
                </SubCard>

                <SubCard title="Revenue" icon={<Wallet size={15} />}>
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

                <SubCard title="Cost Structure" icon={<Settings2 size={15} />}>
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

                    <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-700">Food Cost</p>
                          <p className="mt-1 text-sm text-zinc-500">
                            Enter a manual amount or calculate it as a percentage of sales.
                          </p>
                        </div>

                        <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                          <button
                            type="button"
                            onClick={() => setFoodCostMode("manual")}
                            className={cn(
                              "rounded-xl px-3 py-2 text-sm transition",
                              foodCostMode === "manual"
                                ? "bg-zinc-950 text-white shadow-sm"
                                : "text-zinc-500"
                            )}
                          >
                            Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => setFoodCostMode("percent")}
                            className={cn(
                              "rounded-xl px-3 py-2 text-sm transition",
                              foodCostMode === "percent"
                                ? "bg-zinc-950 text-white shadow-sm"
                                : "text-zinc-500"
                            )}
                          >
                            % of Sales
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                            <MoneyField
                              label="Calculated Food Cost"
                              value={computedFoodCost.toFixed(2)}
                              onChange={() => {}}
                              disabled
                            />
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

                <SubCard title="Notes" icon={<ReceiptText size={15} />}>
                  <textarea
                    rows={5}
                    value={form.notes || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-black/5 bg-zinc-50 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <p className="text-sm font-medium text-zinc-500">Breakdown Lines</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {breakdownLineCount}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">Categorized entries in this report</p>
                </div>

                <div className="rounded-2xl border border-black/5 bg-zinc-50 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <p className="text-sm font-medium text-zinc-500">Breakdown Total</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {formatMoney(breakdownTotal)}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">Sum of all categorized lines</p>
                </div>

                <div className="rounded-2xl border border-black/5 bg-zinc-50 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <p className="text-sm font-medium text-zinc-500">Top Line</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
                    {topBreakdownItem?.category_name || "No items yet"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {topBreakdownItem
                      ? formatMoney(topBreakdownItem.amount)
                      : "Largest categorized amount"}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-zinc-950">Add Breakdown Item</h4>
                  <p className="mt-1 text-sm text-zinc-500">
                    Use mapped categories like Wages, Holiday Pay and Food Purchases to feed the
                    main report automatically.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">Category</label>
                    <select
                      value={newItem.category_id}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, category_id: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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

                  <MoneyField
                    label="Amount"
                    value={newItem.amount}
                    onChange={(value) => setNewItem((prev) => ({ ...prev, amount: value }))}
                  />

                  <div className="md:col-span-2">
                    <Field
                      label="Notes"
                      value={newItem.notes}
                      onChange={(value) => setNewItem((prev) => ({ ...prev, notes: value }))}
                      placeholder="Optional note for this line"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAddBreakdownItem}
                    disabled={addingItem}
                    className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={16} />
                    {addingItem ? "Adding..." : "Add Breakdown Item"}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                {!breakdown || breakdown.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">
                    No breakdown items added to this report yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-zinc-500">
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
                              className="border-t border-zinc-100 bg-white transition hover:bg-zinc-50"
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
                                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="space-y-6">
            <SectionCard
              title="Margin Snapshot"
              description="The financial story of this week, at a glance."
              icon={<Target size={18} />}
            >
              <div className="space-y-3">
                <ExecutiveRow label="Sales ex VAT" value={formatMoney(salesExVat)} />
                <ExecutiveRow
                  label="Gross Profit"
                  value={formatMoney(grossProfit)}
                  valueClassName={grossProfit > 0 ? "text-emerald-600" : "text-rose-600"}
                />
                <ExecutiveRow label="Gross Margin" value={formatPct(grossMarginPct)} />
                <ExecutiveRow label="Labour Total" value={formatMoney(labourTotal)} />
                <ExecutiveRow
                  label="Labour %"
                  value={formatPct(labourPct)}
                  valueClassName={labourPct > 0.25 ? "text-amber-600" : ""}
                />
                <ExecutiveRow
                  label="Net Profit"
                  value={formatMoney(netProfit)}
                  valueClassName={netProfit > 0 ? "text-emerald-600" : "text-rose-600"}
                />
                <ExecutiveRow
                  label="Net Margin"
                  value={formatPct(netMarginPct)}
                  valueClassName={netMarginPct >= 0.18 ? "text-emerald-600" : ""}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Key Signals"
              description="What matters most in this week."
              icon={<Sparkles size={18} />}
            >
              <div className="space-y-3">
                {goodSignals.map((item, index) => (
                  <Signal key={`good-${index}`} tone="good">
                    {item}
                  </Signal>
                ))}

                {warningSignals.map((item, index) => (
                  <Signal key={`warn-${index}`} tone="warn">
                    {item}
                  </Signal>
                ))}

                {goodSignals.length === 0 && warningSignals.length === 0 ? (
                  <Signal>Weekly signals will appear as your data becomes richer.</Signal>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Breakdown Summary"
              description="Context and grouped totals in one place."
              icon={<Layers3 size={18} />}
            >
              <div className="space-y-3">
                <ExecutiveRow label="Week" value={isoWeekInfo ? String(isoWeekInfo.isoWeek) : "-"} />
                <ExecutiveRow label="Year" value={isoWeekInfo ? String(isoWeekInfo.isoYear) : "-"} />
                <ExecutiveRow label="Week Start" value={isoWeekInfo ? isoWeekInfo.start : "-"} />
                <ExecutiveRow label="Week End" value={isoWeekInfo ? isoWeekInfo.end : "-"} />

                {groupedSummaryRows.map((row) => (
                  <ExecutiveRow key={row.label} label={row.label} value={formatMoney(row.value)} />
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
