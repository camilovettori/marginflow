"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Save, Target, TrendingUp, Wallet } from "lucide-react"
import { getCompanyById, getDashboard, type Company, type DashboardData } from "@/services/api"

type MonthlyBudget = {
  revenue: number
  grossProfit: number
  netProfit: number
  labourPct: number
  foodCostPct: number
}

type BudgetPlan = {
  year: number
  annualRevenueTarget: number
  annualGrossProfitTarget: number
  annualNetProfitTarget: number
  annualFixedCostsTarget: number
  labourPctTarget: number
  foodCostPctTarget: number
  months: MonthlyBudget[]
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function fmtPct(value: number) {
  return `${((value ?? 0) * 100).toFixed(1)}%`
}

function emptyMonth(monthIndex: number, annualRevenueTarget: number, annualGrossProfitTarget: number, annualNetProfitTarget: number, labourPctTarget: number, foodCostPctTarget: number): MonthlyBudget {
  return {
    revenue: annualRevenueTarget / 12,
    grossProfit: annualGrossProfitTarget / 12,
    netProfit: annualNetProfitTarget / 12,
    labourPct: labourPctTarget,
    foodCostPct: foodCostPctTarget,
  }
}

function createDefaultPlan(year: number): BudgetPlan {
  const annualRevenueTarget = 0
  const annualGrossProfitTarget = 0
  const annualNetProfitTarget = 0
  const labourPctTarget = 0.32
  const foodCostPctTarget = 0.28

  return {
    year,
    annualRevenueTarget,
    annualGrossProfitTarget,
    annualNetProfitTarget,
    annualFixedCostsTarget: 0,
    labourPctTarget,
    foodCostPctTarget,
    months: Array.from({ length: 12 }, (_, index) =>
      emptyMonth(
        index,
        annualRevenueTarget,
        annualGrossProfitTarget,
        annualNetProfitTarget,
        labourPctTarget,
        foodCostPctTarget
      )
    ),
  }
}

function storageKey(companyId: string, year: number) {
  return `mf_budget_forecast:${companyId}:${year}`
}

function loadPlan(companyId: string, year: number) {
  if (typeof window === "undefined") return createDefaultPlan(year)

  const raw = window.localStorage.getItem(storageKey(companyId, year))
  if (!raw) return createDefaultPlan(year)

  try {
    const parsed = JSON.parse(raw) as BudgetPlan
    if (!parsed?.months?.length) return createDefaultPlan(year)
    return parsed
  } catch {
    return createDefaultPlan(year)
  }
}

function savePlan(companyId: string, plan: BudgetPlan) {
  window.localStorage.setItem(storageKey(companyId, plan.year), JSON.stringify(plan))
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>
    </div>
  )
}

export default function BudgetForecastPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const currentYear = new Date().getFullYear()
  const [company, setCompany] = useState<Company | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [year, setYear] = useState(currentYear)
  const [plan, setPlan] = useState<BudgetPlan>(createDefaultPlan(currentYear))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBudgetPage() {
      try {
        setLoading(true)
        setError(null)

        const [companyData, dashboardData] = await Promise.all([
          getCompanyById(companyId),
          getDashboard(companyId),
        ])

        setCompany(companyData)
        setDashboard(dashboardData)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load budget page."

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

    loadBudgetPage()
  }, [companyId, router])

  useEffect(() => {
    setPlan(loadPlan(companyId, year))
  }, [companyId, year])

  const annualTargetMargin = useMemo(() => {
    return plan.annualRevenueTarget > 0
      ? plan.annualNetProfitTarget / plan.annualRevenueTarget
      : 0
  }, [plan])

  const projectedRevenue = useMemo(
    () => plan.months.reduce((sum, month) => sum + (month.revenue || 0), 0),
    [plan]
  )
  const projectedGrossProfit = useMemo(
    () => plan.months.reduce((sum, month) => sum + (month.grossProfit || 0), 0),
    [plan]
  )
  const projectedNetProfit = useMemo(
    () => plan.months.reduce((sum, month) => sum + (month.netProfit || 0), 0),
    [plan]
  )
  const projectedMargin = projectedRevenue > 0 ? projectedNetProfit / projectedRevenue : 0

  const actualAnnualRevenue = dashboard ? dashboard.total_sales_ex_vat * 13 : 0
  const actualAnnualGrossProfit = dashboard ? dashboard.total_gross_profit * 13 : 0
  const actualAnnualNetProfit = dashboard ? dashboard.total_net_profit * 13 : 0
  const actualMargin = actualAnnualRevenue > 0 ? actualAnnualNetProfit / actualAnnualRevenue : 0
  const actualLabourPct = dashboard && dashboard.total_sales_ex_vat > 0
    ? dashboard.total_wages / dashboard.total_sales_ex_vat
    : 0
  const actualFoodCostPct = dashboard && dashboard.total_sales_ex_vat > 0
    ? dashboard.total_food_cost / dashboard.total_sales_ex_vat
    : 0

  const varianceRevenue = actualAnnualRevenue - plan.annualRevenueTarget
  const varianceNetProfit = actualAnnualNetProfit - plan.annualNetProfitTarget

  const insights = useMemo(() => {
    const notes: string[] = []

    if (plan.annualRevenueTarget > 0 && actualAnnualRevenue > 0) {
      const delta = actualAnnualRevenue - plan.annualRevenueTarget
      notes.push(
        delta >= 0
          ? `Revenue pacing is ${fmtMoney(delta)} ahead of target based on the latest 4-week run rate.`
          : `Revenue pacing is ${fmtMoney(Math.abs(delta))} behind target based on the latest 4-week run rate.`
      )
    }

    if (plan.labourPctTarget > 0) {
      const delta = actualLabourPct - plan.labourPctTarget
      notes.push(
        delta > 0
          ? `Labour is ${fmtPct(delta)} above target at the current run rate.`
          : `Labour is ${fmtPct(Math.abs(delta))} below target at the current run rate.`
      )
    }

    if (plan.annualRevenueTarget > 0 && plan.annualNetProfitTarget > 0) {
      const targetMargin = annualTargetMargin
      if (actualMargin > 0) {
        const gap = actualMargin - targetMargin
        notes.push(
          gap >= 0
            ? `Net margin is ${fmtPct(gap)} ahead of target in the current pace view.`
            : `Net margin is ${fmtPct(Math.abs(gap))} below target in the current pace view.`
        )
      }
    }

    if (!notes.length) {
      notes.push("Set annual targets first, then use this page to compare actual pacing against plan.")
    }

    return notes
  }, [annualTargetMargin, actualAnnualRevenue, actualLabourPct, actualMargin, plan])

  function updateAnnualField(
    field: keyof Pick<
      BudgetPlan,
      | "annualRevenueTarget"
      | "annualGrossProfitTarget"
      | "annualNetProfitTarget"
      | "annualFixedCostsTarget"
      | "labourPctTarget"
      | "foodCostPctTarget"
    >,
    value: number
  ) {
    setPlan((prev) => ({ ...prev, [field]: value }))
  }

  function updateMonth(index: number, field: keyof MonthlyBudget, value: number) {
    setPlan((prev) => ({
      ...prev,
      months: prev.months.map((month, monthIndex) =>
        monthIndex === index ? { ...month, [field]: value } : month
      ),
    }))
  }

  function distributeAnnualPlan() {
    setPlan((prev) => ({
      ...prev,
      months: Array.from({ length: 12 }, () => ({
        revenue: prev.annualRevenueTarget / 12,
        grossProfit: prev.annualGrossProfitTarget / 12,
        netProfit: prev.annualNetProfitTarget / 12,
        labourPct: prev.labourPctTarget,
        foodCostPct: prev.foodCostPctTarget,
      })),
    }))
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      setMessage(null)

      const nextPlan = { ...plan, year }
      savePlan(companyId, nextPlan)
      setPlan(nextPlan)
      setMessage("Budget / Forecast saved locally for this company and year.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save budget plan.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/companies/${companyId}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <h2 className="mt-5 text-5xl font-semibold tracking-tight text-zinc-950">
            Budget / Forecast
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
            Set annual planning assumptions and monthly targets for {company?.name ?? "this company"}.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Planning year
          </p>
          <div className="mt-2 flex items-center gap-3">
            <CalendarDays size={18} className="text-zinc-500" />
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || currentYear)}
              className="w-28 border-none bg-transparent p-0 text-lg font-semibold text-zinc-950 outline-none"
            />
          </div>
          <p className="mt-1 text-sm text-zinc-500">Targets are company-scoped and year-scoped.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
          {message}
        </div>
      )}

      {loading && (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-zinc-500">Loading budget workspace...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <MetricCard
              title="Projected revenue"
              value={fmtMoney(projectedRevenue)}
              subtitle="Sum of monthly revenue targets"
            />
            <MetricCard
              title="Projected net profit"
              value={fmtMoney(projectedNetProfit)}
              subtitle="Sum of monthly net profit targets"
            />
            <MetricCard
              title="Projected margin"
              value={fmtPct(projectedMargin)}
              subtitle="Projected net profit / revenue"
            />
            <MetricCard
              title="Annual fixed costs"
              value={fmtMoney(plan.annualFixedCostsTarget)}
              subtitle="High-level annual overhead target"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                    Annual setup
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Define the top-level assumptions first. Monthly targets can then be adjusted
                    individually.
                  </p>
                </div>

                <button
                  onClick={distributeAnnualPlan}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  Distribute annual plan
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Revenue target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.annualRevenueTarget}
                    onChange={(e) => updateAnnualField("annualRevenueTarget", Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Gross profit target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.annualGrossProfitTarget}
                    onChange={(e) =>
                      updateAnnualField("annualGrossProfitTarget", Number(e.target.value) || 0)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Net profit target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.annualNetProfitTarget}
                    onChange={(e) => updateAnnualField("annualNetProfitTarget", Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Fixed costs target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.annualFixedCostsTarget}
                    onChange={(e) =>
                      updateAnnualField("annualFixedCostsTarget", Number(e.target.value) || 0)
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Labour % target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.labourPctTarget}
                    onChange={(e) => updateAnnualField("labourPctTarget", Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">Food cost % target</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.foodCostPctTarget}
                    onChange={(e) => updateAnnualField("foodCostPctTarget", Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-zinc-500" />
                <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                  Forecast view
                </h3>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Actual annualized revenue</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">
                    {dashboard ? fmtMoney(actualAnnualRevenue) : "—"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Based on latest 4-week run rate
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Variance vs revenue target</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">
                    {dashboard ? fmtMoney(varianceRevenue) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Variance vs net profit target</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">
                    {dashboard ? fmtMoney(varianceNetProfit) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Actual labour %</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtPct(actualLabourPct)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Actual food cost %</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtPct(actualFoodCostPct)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-7 py-6">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-zinc-500" />
                <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                  Monthly breakdown
                </h3>
              </div>
              <p className="mt-1.5 text-sm text-zinc-500">
                Edit monthly targets after the annual plan is set.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Month</th>
                    <th className="px-6 py-4 font-medium">Revenue</th>
                    <th className="px-6 py-4 font-medium">Gross Profit</th>
                    <th className="px-6 py-4 font-medium">Net Profit</th>
                    <th className="px-6 py-4 font-medium">Labour %</th>
                    <th className="px-6 py-4 font-medium">Food Cost %</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.months.map((month, index) => (
                    <tr key={`${year}-${index}`} className="border-t border-zinc-100">
                      <td className="px-6 py-4 font-medium text-zinc-900">{MONTH_NAMES[index]}</td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          step="0.01"
                          value={month.revenue}
                          onChange={(e) =>
                            updateMonth(index, "revenue", Number(e.target.value) || 0)
                          }
                          className="w-36 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          step="0.01"
                          value={month.grossProfit}
                          onChange={(e) =>
                            updateMonth(index, "grossProfit", Number(e.target.value) || 0)
                          }
                          className="w-36 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          step="0.01"
                          value={month.netProfit}
                          onChange={(e) =>
                            updateMonth(index, "netProfit", Number(e.target.value) || 0)
                          }
                          className="w-36 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          step="0.01"
                          value={month.labourPct}
                          onChange={(e) =>
                            updateMonth(index, "labourPct", Number(e.target.value) || 0)
                          }
                          className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          step="0.01"
                          value={month.foodCostPct}
                          onChange={(e) =>
                            updateMonth(index, "foodCostPct", Number(e.target.value) || 0)
                          }
                          className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Target size={18} className="text-zinc-500" />
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Insights</h3>
            </div>
            <div className="mt-4 space-y-3">
              {insights.map((note) => (
                <div key={note} className="rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                  {note}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Budget / Forecast"}
              </button>

              <Link
                href={`/companies/${companyId}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
