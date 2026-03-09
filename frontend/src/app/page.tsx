"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getCompanies,
  getDashboard,
  getMe,
  getPortfolioDashboard,
  type Company,
  type DashboardData,
  type MeResponse,
  type PortfolioData,
} from "@/services/api"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  TrendingUp,
} from "lucide-react"

const CHART_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
  "#f472b6",
  "#22c55e",
  "#fb7185",
  "#38bdf8",
]

type CompanyDashboardMap = Record<string, DashboardData>

type MetricOption =
  | "sales"
  | "grossProfit"
  | "netProfit"
  | "grossMargin"
  | "netMargin"
  | "wagesPct"
  | "foodCostPct"

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

function fmtShortMoney(value: number) {
  const n = value ?? 0
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`
  return `€${n.toFixed(0)}`
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string
  value: string
  subtitle?: string
  tone?: "default" | "yellow" | "green" | "blue"
}) {
  const toneMap = {
    default: "from-white to-zinc-50 border-zinc-200",
    yellow: "from-amber-50 to-yellow-100/80 border-amber-200",
    green: "from-emerald-50 to-lime-50 border-emerald-200",
    blue: "from-sky-50 to-blue-50 border-sky-200",
  }

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-6 shadow-sm ${toneMap[tone]}`}>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">{value}</p>
      {subtitle && <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>}
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

function getMetricLabel(metric: MetricOption) {
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
    case "wagesPct":
      return "Wages %"
    case "foodCostPct":
      return "Food Cost %"
    default:
      return "Revenue"
  }
}

function getMetricValue(week: DashboardData["last_weeks"][number], metric: MetricOption) {
  switch (metric) {
    case "sales":
      return week.sales_ex_vat ?? 0
    case "grossProfit":
      return week.gross_profit ?? 0
    case "netProfit":
      return week.net_profit ?? 0
    case "grossMargin":
      return week.gross_margin_pct ?? 0
    case "netMargin":
      return week.net_margin_pct ?? 0
    case "wagesPct":
      return 0
    case "foodCostPct":
      return 0
    default:
      return week.sales_ex_vat ?? 0
  }
}

export default function Home() {
  const router = useRouter()

  const [companies, setCompanies] = useState<Company[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [companyDashboards, setCompanyDashboards] = useState<CompanyDashboardMap>({})
  const [selectedMetric, setSelectedMetric] = useState<MetricOption>("sales")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setMe] = useState<MeResponse | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const meData = await getMe()
        setMe(meData)

        if (!meData.tenant_id) {
          router.push("/login")
          return
        }

        const companiesData = await getCompanies()
        setCompanies(companiesData)

        const portfolioData = await getPortfolioDashboard()
        setPortfolio(portfolioData)

        const dashboardEntries = await Promise.all(
          companiesData.map(async (company) => {
            const dashboard = await getDashboard(company.id)
            return [company.id, dashboard] as const
          })
        )

        const dashboardMap: CompanyDashboardMap = Object.fromEntries(dashboardEntries)
        setCompanyDashboards(dashboardMap)
      } catch (err) {
        console.error("Dashboard load error:", err)

        const message =
          err instanceof Error ? err.message : "Failed to load dashboard"

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
  }, [router])

  const chartData = useMemo(() => {
    if (!companies.length) return []

    const weekMap = new Map<string, Record<string, string | number>>()

    companies.forEach((company) => {
      const dashboard = companyDashboards[company.id]
      if (!dashboard) return

      dashboard.last_weeks.forEach((week) => {
        if (!weekMap.has(week.week_ending)) {
          weekMap.set(week.week_ending, { week: week.week_ending })
        }

        const row = weekMap.get(week.week_ending)!
        let value = 0

        if (selectedMetric === "wagesPct") {
          value =
            dashboard.total_sales_ex_vat > 0
              ? dashboard.total_wages / dashboard.total_sales_ex_vat
              : 0
        } else if (selectedMetric === "foodCostPct") {
          value =
            dashboard.total_sales_ex_vat > 0
              ? dashboard.total_food_cost / dashboard.total_sales_ex_vat
              : 0
        } else {
          value = getMetricValue(week, selectedMetric)
        }

        row[company.name] = value
      })
    })

    return Array.from(weekMap.values()).sort((a, b) =>
      String(a.week).localeCompare(String(b.week))
    )
  }, [companies, companyDashboards, selectedMetric])

  const bestCompany = useMemo(() => {
    if (!portfolio?.companies?.length) return null
    return [...portfolio.companies].sort((a, b) => b.sales_ex_vat - a.sales_ex_vat)[0]
  }, [portfolio])

  const biggestRisk = useMemo(() => {
    if (!companies.length) return null

    const riskRows = companies
      .map((company) => {
        const dashboard = companyDashboards[company.id]
        if (!dashboard || dashboard.total_sales_ex_vat <= 0) return null

        const wagesPct = dashboard.total_wages / dashboard.total_sales_ex_vat
        return {
          companyName: company.name,
          wagesPct,
        }
      })
      .filter(Boolean) as { companyName: string; wagesPct: number }[]

    if (!riskRows.length) return null

    return riskRows.sort((a, b) => b.wagesPct - a.wagesPct)[0]
  }, [companies, companyDashboards])

  const recommendedFocus = useMemo(() => {
    if (!portfolio) return "Feed more weekly data to unlock stronger margin analysis."

    if (portfolio.total_net_profit <= 0) {
      return "Portfolio is not converting revenue into profit. Review wages, food cost, and fixed costs first."
    }

    if (biggestRisk && biggestRisk.wagesPct > 0.35) {
      return `${biggestRisk.companyName} has labour pressure above target. Tightening rota efficiency is the fastest margin win.`
    }

    return "Revenue is coming through, but the next step is improving profit conversion company by company."
  }, [portfolio, biggestRisk])

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
              className="block rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200"
            >
              <div className="flex items-center gap-3 text-sm font-semibold text-zinc-950">
                <BarChart3 size={16} />
                Dashboard
              </div>
            </Link>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Companies</div>

            <div className="space-y-2 pl-3">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-zinc-500 transition hover:bg-white/70"
                >
                  <Building2 size={16} />
                  <span className="truncate">{company.name}</span>
                </Link>
              ))}

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
            <p className="text-sm font-semibold text-zinc-950">Tenant Overview</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Multi-company visibility across your business.
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
          <div className="mb-8">
            <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">Dashboard</h2>
            <p className="mt-3 text-base text-zinc-500">
              Executive overview across all companies.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading dashboard...</p>
            </div>
          )}

          {!loading && portfolio && (
            <>
              <div>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">Portfolio Overview</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Combined performance across all companies in this tenant.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard
                    title="Revenue"
                    value={fmtMoney(portfolio.total_sales_inc_vat)}
                    subtitle={`Sales ex VAT: ${fmtMoney(portfolio.total_sales_ex_vat)}`}
                    tone="yellow"
                  />
                  <MetricCard
                    title="Gross Profit"
                    value={fmtMoney(portfolio.total_gross_profit)}
                    subtitle="Combined tenant result"
                    tone="blue"
                  />
                  <MetricCard
                    title="Net Profit"
                    value={fmtMoney(portfolio.total_net_profit)}
                    subtitle={
                      portfolio.total_net_profit > 0
                        ? "Positive tenant profitability"
                        : "Profitability under pressure"
                    }
                    tone="green"
                  />
                  <MetricCard
                    title="Companies"
                    value={String(portfolio.companies.length)}
                    subtitle="Active companies in tenant"
                  />
                </div>
              </div>

              <div className="mt-8">
                <SectionCard
                  title={`Company ${getMetricLabel(selectedMetric)} Comparison`}
                  subtitle="Compare all companies across the same weekly timeline."
                  action={
                    <select
                      value={selectedMetric}
                      onChange={(e) => setSelectedMetric(e.target.value as MetricOption)}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none"
                    >
                      <option value="sales">Revenue</option>
                      <option value="grossProfit">Gross Profit</option>
                      <option value="netProfit">Net Profit</option>
                      <option value="grossMargin">Gross Margin %</option>
                      <option value="netMargin">Net Margin %</option>
                    </select>
                  }
                >
                  <div className="p-6">
                    <div className="h-[360px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
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
                          <Legend />
                          {companies.map((company, index) => (
                            <Line
                              key={company.id}
                              type="monotone"
                              dataKey={company.name}
                              stroke={CHART_COLORS[index % CHART_COLORS.length]}
                              strokeWidth={3}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-8">
                <SectionCard
                  title="Company Comparison"
                  subtitle="Side-by-side performance across your companies."
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-zinc-500">
                        <tr>
                          <th className="px-6 py-4 font-medium">Company</th>
                          <th className="px-6 py-4 font-medium">Sales ex VAT</th>
                          <th className="px-6 py-4 font-medium">Gross Profit</th>
                          <th className="px-6 py-4 font-medium">Net Profit</th>
                          <th className="px-6 py-4 font-medium">Gross Margin</th>
                          <th className="px-6 py-4 font-medium">Net Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.companies.map((company) => (
                          <tr key={company.company_id} className="border-t border-zinc-100">
                            <td className="px-6 py-4 font-medium text-zinc-900">
                              <Link
                                href={`/companies/${company.company_id}`}
                                className="flex items-center gap-3 hover:underline"
                              >
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                                  <Building2 size={16} />
                                </div>
                                {company.company_name}
                              </Link>
                            </td>
                            <td className="px-6 py-4">{fmtMoney(company.sales_ex_vat)}</td>
                            <td className="px-6 py-4">{fmtMoney(company.gross_profit)}</td>
                            <td className="px-6 py-4">{fmtMoney(company.net_profit)}</td>
                            <td className="px-6 py-4">{fmtPct(company.gross_margin_pct)}</td>
                            <td className="px-6 py-4">{fmtPct(company.net_margin_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">Top Revenue Company</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {bestCompany
                          ? `${bestCompany.company_name} currently leads with ${fmtMoney(bestCompany.sales_ex_vat)} in sales ex VAT.`
                          : "No data available yet."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">Biggest Risk</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {biggestRisk
                          ? `${biggestRisk.companyName} has the highest labour pressure at ${fmtPct(biggestRisk.wagesPct)}.`
                          : "Not enough data to identify the main operational risk yet."}
                      </p>
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