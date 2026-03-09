"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  getCompanies,
  getDashboard,
  getMe,
  type Company,
  type DashboardData,
} from "@/services/api"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Lightbulb,
  Plus,
  Settings,
  Target,
} from "lucide-react"

const IDEAL_WAGES_PCT = 0.35
const IDEAL_NET_MARGIN_PCT = 0.1

type CompanyMetricOption =
  | "sales"
  | "grossProfit"
  | "netProfit"
  | "grossMargin"
  | "netMargin"

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

function fmtPctPoints(value: number) {
  return `${(value * 100).toFixed(1)} pts`
}

function fmtShortMoney(value: number) {
  const n = value ?? 0
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`
  return `€${n.toFixed(0)}`
}

function fmtDeltaPct(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${(value * 100).toFixed(1)}%`
}

function MetricCard({
  title,
  value,
  subtitle,
  note,
  tone = "default",
}: {
  title: string
  value: string
  subtitle?: string
  note?: string
  tone?: "default" | "yellow" | "red" | "green" | "blue"
}) {
  const toneMap = {
    default: "from-white to-zinc-50 border-zinc-200",
    yellow: "from-amber-50 to-yellow-100/80 border-amber-200",
    red: "from-rose-50 to-orange-50 border-rose-200",
    green: "from-emerald-50 to-lime-50 border-emerald-200",
    blue: "from-sky-50 to-blue-50 border-sky-200",
  }

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-6 shadow-sm ${toneMap[tone]}`}>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">{value}</p>
      {subtitle && <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>}
      {note && <p className="mt-2 text-sm font-medium text-zinc-700">{note}</p>}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-7 py-6">
        <div>
          <h2 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  )
}

function getMetricLabel(metric: CompanyMetricOption) {
  switch (metric) {
    case "sales":
      return "Revenue"
    case "grossProfit":
      return "Gross Profit"
    case "netProfit":
      return "Net Profit"
    case "grossMargin":
      return "Gross Margin %"
    case "netMargin":
      return "Net Margin %"
    default:
      return "Revenue"
  }
}

export default function CompanyPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [companies, setCompanies] = useState<Company[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<CompanyMetricOption>("sales")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const meData = await getMe()

        if (!meData.tenant_id) {
          router.push("/login")
          return
        }

        const companiesData = await getCompanies()
        setCompanies(companiesData)

        const companyData = companiesData.find((c) => c.id === companyId)

        if (!companyData) {
          setError("Company not found or not accessible in this tenant.")
          return
        }

        setCompany(companyData)

        const dashboardData = await getDashboard(companyId)
        setDashboard(dashboardData)
      } catch (err) {
        console.error("Company page error:", err)

        const message =
          err instanceof Error ? err.message : "Failed to load company page"

        if (
          message.toLowerCase().includes("session expired") ||
          message.toLowerCase().includes("401") ||
          message.toLowerCase().includes("missing bearer token") ||
          message.toLowerCase().includes("invalid token")
        ) {
          router.push("/login")
          return
        }

        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [companyId, router])

  const wagesPct = useMemo(() => {
    if (!dashboard || dashboard.total_sales_ex_vat <= 0) return 0
    return dashboard.total_wages / dashboard.total_sales_ex_vat
  }, [dashboard])

  const foodCostPct = useMemo(() => {
    if (!dashboard || dashboard.total_sales_ex_vat <= 0) return 0
    return dashboard.total_food_cost / dashboard.total_sales_ex_vat
  }, [dashboard])

  const cashFlow = useMemo(() => {
    if (!dashboard) return 0
    return (
      dashboard.total_gross_profit -
      dashboard.total_wages -
      dashboard.total_fixed_costs -
      dashboard.total_variable_costs -
      dashboard.total_loans_hp
    )
  }, [dashboard])

  const wagesDelta = useMemo(() => {
    return wagesPct - IDEAL_WAGES_PCT
  }, [wagesPct])

  const netProfitConversion = useMemo(() => {
    if (!dashboard || dashboard.total_sales_ex_vat <= 0) return 0
    return dashboard.total_net_profit / dashboard.total_sales_ex_vat
  }, [dashboard])

  const chartData = useMemo(() => {
    if (!dashboard) return []

    return dashboard.last_weeks.map((week) => {
      let value = 0

      switch (selectedMetric) {
        case "sales":
          value = week.sales_ex_vat
          break
        case "grossProfit":
          value = week.gross_profit
          break
        case "netProfit":
          value = week.net_profit
          break
        case "grossMargin":
          value = week.gross_margin_pct
          break
        case "netMargin":
          value = week.net_margin_pct
          break
        default:
          value = week.sales_ex_vat
      }

      return {
        week: week.week_ending,
        value,
      }
    })
  }, [dashboard, selectedMetric])

  const previousWeekTrend = useMemo(() => {
    if (!dashboard || dashboard.last_weeks.length < 2) return null

    const sortedWeeks = [...dashboard.last_weeks].sort((a, b) =>
      a.week_ending.localeCompare(b.week_ending)
    )

    const previous = sortedWeeks[sortedWeeks.length - 2]
    const current = sortedWeeks[sortedWeeks.length - 1]

    if (!previous || !current || previous.net_profit === 0) return null

    return {
      previousWeek: previous.week_ending,
      currentWeek: current.week_ending,
      currentValue: current.net_profit,
      previousValue: previous.net_profit,
      deltaPct: (current.net_profit - previous.net_profit) / Math.abs(previous.net_profit),
    }
  }, [dashboard])

  const labourAlert = useMemo(() => {
    if (!dashboard) return "No labour insight available yet."

    if (wagesPct > IDEAL_WAGES_PCT) {
      return `Wages are above ideal by ${fmtPctPoints(wagesDelta)}. Labour is the main pressure on margin.`
    }

    return "Labour cost is within a healthier range relative to sales."
  }, [dashboard, wagesPct, wagesDelta])

  const marginInsight = useMemo(() => {
    if (!dashboard) return "No margin insight available yet."

    if (dashboard.avg_net_margin_pct <= 0) {
      return "This company is not converting sales into net profit. Gross profit is being absorbed by operating costs."
    }

    if (dashboard.avg_net_margin_pct < IDEAL_NET_MARGIN_PCT) {
      return "Net margin is positive but still weak. Profit conversion from revenue remains inefficient."
    }

    return "Net margin is in a healthier zone and converting revenue more efficiently."
  }, [dashboard])

  const recommendedFocus = useMemo(() => {
    if (!dashboard) return "Feed more weekly data to unlock better recommendations."

    if (wagesPct > IDEAL_WAGES_PCT) {
      return "Reduce labour pressure first. Tighten rota efficiency before chasing more sales."
    }

    if (foodCostPct > 0.3) {
      return "Review food cost next. Margin leakage is likely happening through purchasing or portion control."
    }

    if (cashFlow < 0) {
      return "Cash generation is negative. Protect cash before expanding spend."
    }

    return "This company is relatively stable. Focus next on improving net profit conversion week by week."
  }, [dashboard, wagesPct, foodCostPct, cashFlow])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(244,244,245,1)_40%,_rgba(240,240,243,1)_100%)] text-zinc-950">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[300px_1fr]">
        <aside className="flex min-h-screen flex-col border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,244,246,0.86))] px-5 py-7 backdrop-blur">
          <div className="rounded-[32px] border border-white/70 bg-white/50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">MarginFlow</h1>
                <p className="text-sm text-zinc-500">Margin intelligence</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            <Link
              href="/"
              className="block rounded-2xl px-4 py-3 text-sm text-zinc-500 transition hover:bg-white/70"
            >
              <div className="flex items-center gap-3">
                <BarChart3 size={16} />
                Dashboard
              </div>
            </Link>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Companies</div>

            <div className="space-y-2 pl-3">
              {companies.map((item) => {
                const isActive = item.id === companyId

                return (
                  <Link
                    key={item.id}
                    href={`/companies/${item.id}`}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200"
                        : "text-zinc-500 hover:bg-white/70"
                    }`}
                  >
                    <Building2 size={16} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}

              <Link
                href="/companies/new"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-white/70"
              >
                <Plus size={16} />
                <span>Add Company</span>
              </Link>
            </div>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Weekly Reports</div>
            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Analytics</div>
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Company View</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Focused performance view for a single company.
            </p>
          </div>

          <div className="mt-auto pt-8">
            <button className="flex w-full items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white">
              <Settings size={16} />
              Settings
            </button>
          </div>
        </aside>

        <section className="px-6 py-7 md:px-8 xl:px-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                {company?.name ?? "Company"}
              </h2>
              <p className="mt-3 text-base text-zinc-500">
                Weekly financial performance for this company.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start">
              <Link
                href={`/companies/${companyId}/reports/new`}
                className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                <Plus size={16} />
                Add Weekly Report
              </Link>

              <Link
                href={`/companies/${companyId}/settings`}
                className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900"
                title="Company Settings"
              >
                <Settings size={18} />
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading company dashboard...</p>
            </div>
          )}

          {!loading && dashboard && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                <MetricCard
                  title="Revenue"
                  value={fmtMoney(dashboard.total_sales_inc_vat)}
                  subtitle={`Sales ex VAT: ${fmtMoney(dashboard.total_sales_ex_vat)}`}
                  note={
                    dashboard.total_sales_ex_vat > 0
                      ? "Core revenue base for this company."
                      : "No meaningful sales base yet."
                  }
                  tone="yellow"
                />

                <MetricCard
                  title="Wages %"
                  value={fmtPct(wagesPct)}
                  subtitle={`Wages: ${fmtMoney(dashboard.total_wages)}`}
                  note={
                    wagesPct > IDEAL_WAGES_PCT
                      ? `${fmtPctPoints(wagesDelta)} above ideal target`
                      : "Within healthier labour range"
                  }
                  tone="red"
                />

                <MetricCard
                  title="Net Profit"
                  value={fmtMoney(dashboard.total_net_profit)}
                  subtitle={`Gross Profit: ${fmtMoney(dashboard.total_gross_profit)}`}
                  note={
                    dashboard.total_gross_profit > 0
                      ? `${fmtPct(netProfitConversion)} profit conversion from revenue`
                      : "No gross profit conversion yet"
                  }
                  tone="green"
                />

                <MetricCard
                  title="Cash Flow"
                  value={fmtMoney(cashFlow)}
                  subtitle={`Food Cost: ${fmtMoney(dashboard.total_food_cost)}`}
                  note={cashFlow < 0 ? "Negative operating result" : "Positive operating result"}
                  tone="blue"
                />
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <MetricCard
                  title="Profit Conversion"
                  value={fmtPct(netProfitConversion)}
                  subtitle="Net profit as % of sales ex VAT"
                  note="North-star profitability metric"
                  tone="green"
                />

                <MetricCard
                  title="Food Cost %"
                  value={fmtPct(foodCostPct)}
                  subtitle={`Food Cost: ${fmtMoney(dashboard.total_food_cost)}`}
                  note={
                    foodCostPct > 0.3
                      ? "Food cost is pressuring margin"
                      : "Food cost is in a healthier range"
                  }
                  tone="yellow"
                />

                <MetricCard
                  title="Trend vs Previous Week"
                  value={
                    previousWeekTrend
                      ? fmtDeltaPct(previousWeekTrend.deltaPct)
                      : "N/A"
                  }
                  subtitle={
                    previousWeekTrend
                      ? `${fmtMoney(previousWeekTrend.previousValue)} → ${fmtMoney(previousWeekTrend.currentValue)}`
                      : "Not enough weekly history"
                  }
                  note="Net profit movement vs prior week"
                  tone="blue"
                />
              </div>

              <div className="mt-8">
                <SectionCard
                  title={`Weekly ${getMetricLabel(selectedMetric)} Trend`}
                  subtitle={`Performance trend for ${company?.name ?? "this company"}.`}
                  action={
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600">
                        Last {dashboard.weeks} Weeks
                      </div>
                      <select
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value as CompanyMetricOption)}
                        className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none"
                      >
                        <option value="sales">Revenue</option>
                        <option value="grossProfit">Gross Profit</option>
                        <option value="netProfit">Net Profit</option>
                        <option value="grossMargin">Gross Margin %</option>
                        <option value="netMargin">Net Margin %</option>
                      </select>
                    </div>
                  }
                >
                  <div className="p-6">
                    <div className="h-[420px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="companyMetricFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 12 }} />
                          <YAxis
                            tickFormatter={(value) =>
                              selectedMetric === "grossMargin" || selectedMetric === "netMargin"
                                ? fmtPct(Number(value))
                                : fmtShortMoney(Number(value))
                            }
                            tick={{ fill: "#71717a", fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value) =>
                              selectedMetric === "grossMargin" || selectedMetric === "netMargin"
                                ? fmtPct(Number(value))
                                : fmtMoney(Number(value))
                            }
                            contentStyle={{
                              borderRadius: 16,
                              border: "1px solid #e4e4e7",
                              background: "#ffffff",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#60a5fa"
                            strokeWidth={3}
                            fill="url(#companyMetricFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-8">
                <SectionCard
                  title="Profit Breakdown"
                  subtitle="How revenue is being converted into profit."
                >
                  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Revenue</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        {fmtMoney(dashboard.total_sales_ex_vat)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Food Cost</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        - {fmtMoney(dashboard.total_food_cost)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Gross Profit</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        {fmtMoney(dashboard.total_gross_profit)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Wages</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        - {fmtMoney(dashboard.total_wages)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Fixed Costs</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        - {fmtMoney(dashboard.total_fixed_costs)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Variable Costs</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        - {fmtMoney(dashboard.total_variable_costs)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Loans / HP</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        - {fmtMoney(dashboard.total_loans_hp)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
                      <p className="text-sm font-medium text-zinc-500">Net Profit</p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        {fmtMoney(dashboard.total_net_profit)}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-8">
                <SectionCard
                  title="Last Weeks"
                  subtitle="Recent weekly performance for this company."
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-zinc-500">
                        <tr>
                          <th className="px-6 py-4 font-medium">Week Ending</th>
                          <th className="px-6 py-4 font-medium">Sales ex VAT</th>
                          <th className="px-6 py-4 font-medium">Gross Profit</th>
                          <th className="px-6 py-4 font-medium">Gross Margin</th>
                          <th className="px-6 py-4 font-medium">Net Profit</th>
                          <th className="px-6 py-4 font-medium">Net Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.last_weeks.map((week) => (
                          <tr key={week.week_ending} className="border-t border-zinc-100">
                            <td className="px-6 py-4 text-zinc-900">{week.week_ending}</td>
                            <td className="px-6 py-4">{fmtMoney(week.sales_ex_vat)}</td>
                            <td className="px-6 py-4">{fmtMoney(week.gross_profit)}</td>
                            <td className="px-6 py-4">{fmtPct(week.gross_margin_pct)}</td>
                            <td className="px-6 py-4">{fmtMoney(week.net_profit)}</td>
                            <td className="px-6 py-4">{fmtPct(week.net_margin_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">Labour Alert</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{labourAlert}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                      <Target size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">Margin Insight</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{marginInsight}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      <Lightbulb size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">Recommended Focus</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{recommendedFocus}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}