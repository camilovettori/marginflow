"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clock3,
  Lightbulb,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import WorkspaceShell from "@/components/workspace-shell"
import {
  getCompanies,
  getDashboard,
  getPortfolioDashboard,
  type Company,
  type DashboardData,
  type PortfolioData,
} from "@/services/api"

type CompanyDashboardMap = Record<string, DashboardData>

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
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

function CompanyStatusChip({ company, dashboard }: { company: Company; dashboard?: DashboardData }) {
  if (!dashboard || dashboard.last_weeks.length === 0) {
    return (
      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
        Needs reports
      </span>
    )
  }

  if (company.sales_source === "zoho") {
    return (
      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
        Connected
      </span>
    )
  }

  if (dashboard.total_net_profit > 0) {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Healthy
      </span>
    )
  }

  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
      Review
    </span>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string
  value: string
  subtitle: string
  tone?: "default" | "sky" | "emerald" | "amber" | "rose"
}) {
  const toneClass = {
    default: "border-zinc-200 bg-white",
    sky: "border-sky-200 bg-sky-50/80",
    emerald: "border-emerald-200 bg-emerald-50/80",
    amber: "border-amber-200 bg-amber-50/80",
    rose: "border-rose-200 bg-rose-50/80",
  }[tone]

  return (
    <div className={`rounded-[28px] border p-6 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>
    </div>
  )
}

function CompanyCard({
  company,
  dashboard,
}: {
  company: Company
  dashboard?: DashboardData
}) {
  const status = dashboard?.last_weeks.length ? dashboard.total_net_profit > 0 ? "Healthy" : "Review" : "Needs reports"
  const lastWeek = dashboard?.last_weeks?.[dashboard.last_weeks.length - 1]?.week_ending

  return (
    <Link
      href={`/companies/${company.id}`}
      className="group rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold tracking-tight text-zinc-950">{company.name}</p>
              <CompanyStatusChip company={company} dashboard={dashboard} />
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {company.sales_source ? `Sales source: ${company.sales_source}` : "Ready for workspace"}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
          Open workspace
          <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-zinc-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Revenue</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">
            {dashboard ? fmtMoney(dashboard.total_sales_ex_vat) : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Net profit</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">
            {dashboard ? fmtMoney(dashboard.total_net_profit) : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Net margin</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">
            {dashboard ? fmtPct(dashboard.avg_net_margin_pct) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-sm text-zinc-500">
        <span>Latest week: {lastWeek ?? "No activity yet"}</span>
        <span className="font-medium text-zinc-700">{status}</span>
      </div>
    </Link>
  )
}

function ActivityItem({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight text-zinc-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p>
      </div>
    </div>
  )
}

export default function CompanyHub() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [dashboards, setDashboards] = useState<CompanyDashboardMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHub() {
      try {
        setLoading(true)
        setError(null)

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

        setDashboards(Object.fromEntries(dashboardEntries))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load portfolio home.")
      } finally {
        setLoading(false)
      }
    }

    loadHub()
  }, [])

  const rankedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      const aRevenue = dashboards[a.id]?.total_sales_ex_vat ?? 0
      const bRevenue = dashboards[b.id]?.total_sales_ex_vat ?? 0
      return bRevenue - aRevenue
    })
  }, [companies, dashboards])

  const chartData = useMemo(() => {
    if (!companies.length) return []

    const weekMap = new Map<string, Record<string, string | number>>()

    companies.forEach((company) => {
      const dashboard = dashboards[company.id]
      if (!dashboard) return

      dashboard.last_weeks.forEach((week) => {
        if (!weekMap.has(week.week_ending)) {
          weekMap.set(week.week_ending, { week: week.week_ending })
        }

        const row = weekMap.get(week.week_ending)!
        row[company.name] = week.sales_ex_vat
      })
    })

    return Array.from(weekMap.values()).sort((a, b) =>
      String(a.week).localeCompare(String(b.week))
    )
  }, [companies, dashboards])

  const bestCompany = useMemo(() => {
    if (!portfolio?.companies?.length) return null
    return [...portfolio.companies].sort((a, b) => b.sales_ex_vat - a.sales_ex_vat)[0]
  }, [portfolio])

  const weakestCompany = useMemo(() => {
    if (!companies.length) return null

    const companiesWithData = companies
      .map((company) => {
        const dashboard = dashboards[company.id]
        if (!dashboard || dashboard.total_sales_ex_vat <= 0) return null
        return {
          company,
          dashboard,
          margin: dashboard.avg_net_margin_pct,
        }
      })
      .filter(Boolean) as Array<{ company: Company; dashboard: DashboardData; margin: number }>

    if (!companiesWithData.length) return null
    return companiesWithData.sort((a, b) => a.margin - b.margin)[0]
  }, [companies, dashboards])

  const inactiveCompany = useMemo(() => {
    if (!companies.length) return null
    return companies.find((company) => {
      const dashboard = dashboards[company.id]
      return !dashboard || dashboard.last_weeks.length === 0 || dashboard.total_sales_ex_vat <= 0
    }) ?? null
  }, [companies, dashboards])

  const atRiskCompanies = useMemo(() => {
    return companies
      .map((company) => {
        const dashboard = dashboards[company.id]
        if (!dashboard || dashboard.total_sales_ex_vat <= 0) return null
        return {
          company,
          dashboard,
          margin: dashboard.avg_net_margin_pct,
          sales: dashboard.total_sales_ex_vat,
        }
      })
      .filter(Boolean)
      .filter((item) => item!.margin < 0.08) as Array<{
      company: Company
      dashboard: DashboardData
      margin: number
      sales: number
    }>
  }, [companies, dashboards])

  const recentActivity = useMemo(() => {
    const items: Array<{ key: string; title: string; subtitle: string; icon: React.ReactNode }> = []

    const companiesWithLatestWeek = companies
      .map((company) => {
        const dashboard = dashboards[company.id]
        const latestWeek = dashboard?.last_weeks?.[dashboard.last_weeks.length - 1]
        return latestWeek ? { company, latestWeek } : null
      })
      .filter(Boolean) as Array<{ company: Company; latestWeek: DashboardData["last_weeks"][number] }>

    companiesWithLatestWeek
      .sort((a, b) => b.latestWeek.week_ending.localeCompare(a.latestWeek.week_ending))
      .slice(0, 3)
      .forEach((item) => {
        items.push({
          key: `${item.company.id}-${item.latestWeek.week_ending}`,
          title: `${item.company.name} updated ${item.latestWeek.week_ending}`,
          subtitle: `Revenue ${fmtMoney(item.latestWeek.sales_ex_vat)} · Net profit ${fmtMoney(item.latestWeek.net_profit)}`,
          icon: <Clock3 size={16} />,
        })
      })

    if (!items.length) {
      items.push({
        key: "empty",
        title: "No recent activity yet",
        subtitle: "As weekly reports come in, this section will show the latest movement across the portfolio.",
        icon: <Clock3 size={16} />,
      })
    }

    return items
  }, [companies, dashboards])

  const portfolioFocus = useMemo(() => {
    if (!portfolio) {
      return [
        "Portfolio data is loading.",
        "Once the tenant data is available, the command center will highlight where to focus.",
      ]
    }

    const notes = [
      bestCompany
        ? `${bestCompany.company_name} is leading the portfolio with ${fmtMoney(bestCompany.sales_ex_vat)} in sales ex VAT.`
        : "No leading company yet. Add activity to see the portfolio leader.",
      weakestCompany
        ? `${weakestCompany.company.name} has the weakest net margin at ${fmtPct(weakestCompany.margin)}.`
        : "No company is generating enough data to score margin leadership yet.",
      inactiveCompany
        ? `${inactiveCompany.name} needs weekly reports before it can participate in portfolio performance tracking.`
        : "All companies have at least some weekly activity.",
    ]

    return notes
  }, [bestCompany, inactiveCompany, portfolio, weakestCompany])

  const portfolioHealth = useMemo(() => {
    if (!portfolio) return "Portfolio visibility grows as weekly data comes in."
    if (portfolio.total_net_profit <= 0) return "The portfolio is active, but profitability still needs attention."
    if (atRiskCompanies.length > 0) return "Healthy overall, but a few companies need margin attention."
    return "Strong portfolio conversion. Keep an eye on weekly pacing and labor discipline."
  }, [atRiskCompanies.length, portfolio])

  return (
    <WorkspaceShell mode="tenant">
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(39,39,42,0.92),rgba(63,63,70,0.88))] p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
                Portfolio / Home
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-white/60">
                MarginFlow Home
              </p>
              <h2 className="mt-3 text-5xl font-semibold tracking-tight">
                Portfolio Command Center
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">
                Track portfolio performance, identify risk areas, and jump straight into each company
                workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/companies/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-100"
              >
                <Plus size={16} />
                Add Company
              </Link>
            </div>
          </div>

          <div className="relative mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">Portfolio health</p>
              <p className="mt-3 text-2xl font-semibold">{portfolioHealth}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">Attention now</p>
              <p className="mt-3 text-2xl font-semibold">
                {atRiskCompanies.length > 0
                  ? `${atRiskCompanies.length} companies below margin threshold`
                  : inactiveCompany
                    ? `${inactiveCompany.name} needs activity`
                    : "No immediate blockers"}
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">Quick jump</p>
              <p className="mt-3 text-2xl font-semibold">
                {bestCompany ? bestCompany.company_name : "Open a company workspace"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-zinc-500">Loading portfolio command center...</p>
          </div>
        )}

        {!loading && portfolio && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              <MetricCard
                title="Portfolio revenue"
                value={fmtMoney(portfolio.total_sales_ex_vat)}
                subtitle="Combined sales ex VAT across the tenant"
                tone="amber"
              />
              <MetricCard
                title="Portfolio gross profit"
                value={fmtMoney(portfolio.total_gross_profit)}
                subtitle="Gross profit across all companies"
                tone="sky"
              />
              <MetricCard
                title="Portfolio net profit"
                value={fmtMoney(portfolio.total_net_profit)}
                subtitle="Net profit across all companies"
                tone={portfolio.total_net_profit >= 0 ? "emerald" : "rose"}
              />
              <MetricCard
                title="Active companies"
                value={String(portfolio.companies.length)}
                subtitle="Companies available in this tenant"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <MetricCard
                title="Average net margin"
                value={fmtPct(
                  portfolio.companies.length
                    ? portfolio.companies.reduce((sum, company) => sum + company.net_margin_pct, 0) /
                        portfolio.companies.length
                    : 0
                )}
                subtitle="Across companies in the tenant"
                tone="emerald"
              />
              <MetricCard
                title="Companies above target"
                value={String(
                  portfolio.companies.filter((company) => company.net_margin_pct >= 0.1).length
                )}
                subtitle="Using a simple 10% margin baseline"
                tone="sky"
              />
              <MetricCard
                title="Companies at risk"
                value={String(atRiskCompanies.length)}
                subtitle="Net margin below 8% on the latest window"
                tone={atRiskCompanies.length > 0 ? "rose" : "emerald"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <TrendingUp size={18} className="text-zinc-500" />
                  <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                    Portfolio trend
                  </h3>
                </div>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Revenue trend across the latest weekly windows for every company in the tenant.
                </p>
                <div className="mt-6 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={fmtShortMoney} />
                      <Tooltip
                        formatter={(value) => fmtMoney(Number(value ?? 0))}
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #e4e4e7",
                          background: "#ffffff",
                        }}
                      />
                      {rankedCompanies.slice(0, 4).map((company, index) => (
                        <Line
                          key={company.id}
                          type="monotone"
                          dataKey={company.name}
                          stroke={["#0f172a", "#2563eb", "#059669", "#f59e0b"][index % 4]}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Lightbulb size={18} className="text-zinc-500" />
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      Where to focus
                    </h3>
                  </div>
                  <div className="mt-5 space-y-4">
                    {portfolioFocus.map((note) => (
                      <div key={note} className="rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} className="text-zinc-500" />
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      Priority alerts
                    </h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {atRiskCompanies.length > 0 ? (
                      atRiskCompanies.slice(0, 3).map((item) => (
                        <div key={item.company.id} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                          <p className="text-sm font-semibold text-rose-800">{item.company.name}</p>
                          <p className="mt-1 text-sm leading-6 text-rose-700">
                            Net margin is {fmtPct(item.margin)} and needs attention.
                          </p>
                        </div>
                      ))
                    ) : inactiveCompany ? (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                        <p className="text-sm font-semibold text-amber-800">{inactiveCompany.name}</p>
                        <p className="mt-1 text-sm leading-6 text-amber-700">
                          This company needs weekly reports before it can be compared properly.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="text-sm font-semibold text-emerald-800">All clear</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-700">
                          No urgent portfolio alerts right now.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <Clock3 size={18} className="text-zinc-500" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                    Recent portfolio activity
                  </h3>
                </div>
                <div className="mt-5 space-y-3">
                  {recentActivity.map((item) => (
                    <ActivityItem key={item.key} title={item.title} subtitle={item.subtitle} icon={item.icon} />
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-zinc-500" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                    Company workspaces
                  </h3>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Open a company workspace to review reports, analytics, planning, and settings.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {rankedCompanies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      dashboard={dashboards[company.id]}
                    />
                  ))}
                  <Link
                    href="/companies/new"
                    className="group flex min-h-[240px] items-center justify-center rounded-[30px] border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white"
                  >
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                        <Plus size={20} />
                      </div>
                      <p className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">
                        Add Company
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Create a new business and bring it into the portfolio.
                      </p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
