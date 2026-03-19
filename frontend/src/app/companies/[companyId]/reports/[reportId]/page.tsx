"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  getWeeklyReportById,
  updateWeeklyReport,
  generateWeeklyReportPdf,
  sendWeeklyReportEmail,
  type WeeklyReportDetail,
  type WeeklyReportUpdatePayload,
} from "@/services/api"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  Mail,
  Percent,
  Save,
  Settings2,
  Sparkles,
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
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
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
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-zinc-400">
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
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-zinc-400">
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

function MetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  )
}

export default function WeeklyReportDetailPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const reportId = params.reportId as string

  const [report, setReport] = useState<WeeklyReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<"pdf" | "email" | null>(null)

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

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true)
        setError(null)

        const data = await getWeeklyReportById(reportId)
        setReport(data)

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

  const grossProfit = useMemo(() => {
    return salesExVat - computedFoodCost
  }, [salesExVat, computedFoodCost])

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
  }, [salesExVat, labourTotal, computedFoodCost, form.fixed_costs, form.variable_costs, form.loans_hp, form.vat_due])

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

  const insights = useMemo(() => {
    const list: string[] = []

    if (labourPct > 0.35) {
      list.push("Labour cost is above target. Review staffing levels on lower-traffic days.")
    }

    if (grossMarginPct < 0.6) {
      list.push("Gross margin is below healthy range. Review food cost, wastage, and supplier pricing.")
    }

    if (netMarginPct < 0.1) {
      list.push("Net margin is below target. Focus on labour control, pricing, and cost discipline.")
    }

    if (list.length === 0) {
      list.push("This week is performing within healthy margin thresholds.")
    }

    return list
  }, [labourPct, grossMarginPct, netMarginPct])

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

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

      const result = await generateWeeklyReportPdf(reportId)

      if (result.download_url) {
        window.open(result.download_url, "_blank")
      }

      setSuccessMessage("PDF generation started successfully.")
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

      const result = await sendWeeklyReportEmail(reportId)
      setSuccessMessage(result.message || "Weekly report email sent successfully.")
    } catch (err) {
      console.error("Send email error:", err)
      setError(err instanceof Error ? err.message : "Failed to send weekly report email.")
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-8 md:px-8 xl:px-10">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-zinc-500">Loading weekly report...</p>
        </div>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-8 md:px-8 xl:px-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-red-700">
          Weekly report not found.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] px-6 py-8 text-zinc-950 md:px-8 xl:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4">
              <Link
                href={`/companies/${companyId}/reports`}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <ArrowLeft size={16} />
                Back to Weekly Reports
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                <Building2 size={20} />
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
                  {report.company_name || "Selected Company"} — Weekly Intelligence Report
                </h1>
                <p className="mt-2 text-base text-zinc-600">{buildWeekLabel(report)}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatDate(report.week_start)} → {formatDate(report.week_end)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start">
            <button
              onClick={handleGeneratePdf}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} />
              {busyAction === "pdf" ? "Generating..." : "Generate PDF"}
            </button>

            <button
              onClick={handleSendEmail}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Mail size={16} />
              {busyAction === "email" ? "Sending..." : "Send by Email"}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Wallet size={18} />}
            title="Sales ex VAT"
            value={formatMoney(form.sales_ex_vat)}
            subtitle="Core revenue base"
          />
          <MetricCard
            icon={<TrendingUp size={18} />}
            title="Gross Profit"
            value={formatMoney(grossProfit)}
            subtitle="Revenue minus food cost"
          />
          <MetricCard
            icon={<Percent size={18} />}
            title="Net Margin"
            value={formatPct(netMarginPct)}
            subtitle="Bottom-line efficiency"
          />
          <MetricCard
            icon={<Settings2 size={18} />}
            title="Labour %"
            value={formatPct(labourPct)}
            subtitle="Labour pressure vs revenue"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <CalendarDays size={16} className="text-zinc-600" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Week Details
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Week Ending"
                  type="date"
                  value={form.week_ending}
                  onChange={(value) => setForm((prev) => ({ ...prev, week_ending: value }))}
                />

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
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
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Sales
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Weekly revenue inputs for the selected report.
                </p>
              </div>

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
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Operational Costs
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Standard cost structure with the same premium logic used in Add Weekly Report.
                </p>
              </div>

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

                <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-700">Food Cost</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Use a manual amount or calculate from sales percentage.
                      </p>
                    </div>

                    <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setFoodCostMode("manual")}
                        className={`rounded-xl px-3 py-2 text-sm transition ${
                          foodCostMode === "manual"
                            ? "bg-zinc-950 text-white shadow-sm"
                            : "text-zinc-500"
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setFoodCostMode("percent")}
                        className={`rounded-xl px-3 py-2 text-sm transition ${
                          foodCostMode === "percent"
                            ? "bg-zinc-950 text-white shadow-sm"
                            : "text-zinc-500"
                        }`}
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
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                Notes
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Weekly notes, context, anomalies, events or operational observations.
              </p>

              <textarea
                rows={7}
                value={form.notes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                placeholder="Add operational notes, staffing context, promotions, issues or comments..."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950">
                <Sparkles size={18} />
                Live Margin Preview
              </h3>

              <div className="mt-5 space-y-3">
                <MetricRow label="Gross Profit" value={formatMoney(grossProfit)} />
                <MetricRow label="Gross Margin" value={formatPct(grossMarginPct)} />
                <MetricRow label="Labour Total" value={formatMoney(labourTotal)} />
                <MetricRow label="Labour %" value={formatPct(labourPct)} />
                <MetricRow label="Net Profit" value={formatMoney(netProfit)} />
                <MetricRow label="Net Margin" value={formatPct(netMarginPct)} />
              </div>
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950">
                <Sparkles size={18} />
                Insights & Recommendations
              </h3>

              <div className="mt-4 space-y-3">
                {insights.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950">
                <CalendarDays size={18} />
                Week Context
              </h3>

              <div className="mt-5 space-y-3">
                <MetricRow label="Week" value={isoWeekInfo ? String(isoWeekInfo.isoWeek) : "-"} />
                <MetricRow label="Year" value={isoWeekInfo ? String(isoWeekInfo.isoYear) : "-"} />
                <MetricRow label="Week Start" value={isoWeekInfo ? isoWeekInfo.start : "-"} />
                <MetricRow label="Week End" value={isoWeekInfo ? isoWeekInfo.end : "-"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}