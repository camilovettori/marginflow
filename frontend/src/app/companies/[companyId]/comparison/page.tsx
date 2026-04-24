"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  Building2,
  ShieldAlert,
  TrendingUp,
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
import { getCompanies, getDashboard, type Company, type DashboardData } from "@/services/api"
import WorkspacePageHeader from "@/components/workspace-page-header"

type DashboardMap = Record<string, DashboardData>
type RangeOption = "4w" | "3m" | "6m" | "12m"
type MetricOption = "revenue" | "grossProfit" | "netProfit" | "netMargin"

const rangeOptions: Array<{ value: RangeOption; label: string; weeksToShow: number }> = [
  { value: "4w", label: "4 Weeks", weeksToShow: 4 },
  { value: "3m", label: "3 Months", weeksToShow: 12 },
  { value: "6m", label: "6 Months", weeksToShow: 24 },
  { value: "12m", label: "12 Months", weeksToShow: 52 },
]

const metricOptions: Array<{ value: MetricOption; label: string }> = [
  { value: "revenue", label: "Revenue" },
  { value: "grossProfit", label: "Gross Profit" },
  { value: "netProfit", label: "Net Profit" },
  { value: "netMargin", label: "Net Margin" },
]

const COLORS = ["#0f172a", "#2563eb", "#059669", "#f59e0b", "#7c3aed", "#dc2626"]

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

function metricLabel(value: MetricOption) {
  return metricOptions.find((item) => item.value === value)?.label ?? "Revenue"
}

function metricValue(week: DashboardData["last_weeks"][number], metric: MetricOption) {
  switch (metric) {
    case "revenue":
      return week.sales_ex_vat ?? 0
    case "grossProfit":
      return week.gross_profit ?? 0
    case "netProfit":
      return week.net_profit ?? 0
    case "netMargin":
      return week.net_margin_pct ?? 0
  }
}

function getWindowMetrics(dashboard: DashboardData | undefined, weeksToShow: number) {
  const weeks = dashboard?.last_weeks.slice(-weeksToShow) ?? []
  const revenue = weeks.reduce((sum, week) => sum + (week.sales_ex_vat || 0), 0)
  const grossProfit = weeks.reduce((sum, week) => sum + (week.gross_profit || 0), 0)
  const netProfit = weeks.reduce((sum, week) => sum + (week.net_profit || 0), 0)
  const grossMargin = weeks.length
    ? weeks.reduce((sum, week) => sum + (week.gross_margin_pct || 0), 0) / weeks.length
    : 0
  const netMargin = weeks.length
    ? weeks.reduce((sum, week) => sum + (week.net_margin_pct || 0), 0) / weeks.length
    : 0

  return { weeks, revenue, grossProfit, netProfit, grossMargin, netMargin }
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "good" | "warn" | "bad"
  children: React.ReactNode
}) {
  const classes = {
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-600",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone]
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${classes}`}>{children}</span>
}

function Card({
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
    sky: "border-sky-200 bg-sky-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    rose: "border-rose-200 bg-rose-50/60",
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-transform duration-150 hover:-translate-y-0.5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 md:text-[2.35rem]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{subtitle}</p>
    </div>
  )
}

export default function CompanyComparisonPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [companies, setCompanies] = useState<Company[]>([])
  const [dashboards, setDashboards] = useState<DashboardMap>({})
  const [selectedRange, setSelectedRange] = useState<RangeOption>("4w")
  const [selectedMetric, setSelectedMetric] = useState<MetricOption>("revenue")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadComparison() {
      try {
        setLoading(true)
        setError(null)
        const companiesData = await getCompanies()
        setCompanies(companiesData)
        const dashboardEntries = await Promise.all(
          companiesData.map(async (company) => {
            const dashboard = await getDashboard(company.id, 52)
            return [company.id, dashboard] as const
          })
        )
        setDashboards(Object.fromEntries(dashboardEntries))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load company comparison."
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
    loadComparison()
  }, [router])

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? null,
    [companies, companyId]
  )

  const rankedCompanies = useMemo(
    () =>
      [...companies].sort((a, b) => (dashboards[b.id]?.total_sales_ex_vat ?? 0) - (dashboards[a.id]?.total_sales_ex_vat ?? 0)),
    [companies, dashboards]
  )

  const selectedRank = useMemo(
    () => rankedCompanies.findIndex((company) => company.id === companyId) + 1 || null,
    [rankedCompanies, companyId]
  )

  const weeksToShow = rangeOptions.find((option) => option.value === selectedRange)?.weeksToShow ?? 4

  const selectedDashboard = dashboards[companyId]
  const selectedMetrics = getWindowMetrics(selectedDashboard, weeksToShow)

  const portfolioTotals = useMemo(() => {
    return rankedCompanies.reduce(
      (acc, company) => {
        const metrics = getWindowMetrics(dashboards[company.id], weeksToShow)
        acc.revenue += metrics.revenue
        acc.grossProfit += metrics.grossProfit
        acc.netProfit += metrics.netProfit
        acc.grossMargin += metrics.grossMargin
        acc.netMargin += metrics.netMargin
        acc.count += metrics.weeks.length > 0 ? 1 : 0
        return acc
      },
      { revenue: 0, grossProfit: 0, netProfit: 0, grossMargin: 0, netMargin: 0, count: 0 }
    )
  }, [dashboards, rankedCompanies, weeksToShow])

  const portfolioAverage = useMemo(() => {
    const divisor = portfolioTotals.count || 1
    return {
      revenue: portfolioTotals.revenue / divisor,
      grossProfit: portfolioTotals.grossProfit / divisor,
      netProfit: portfolioTotals.netProfit / divisor,
      grossMargin: portfolioTotals.grossMargin / divisor,
      netMargin: portfolioTotals.netMargin / divisor,
    }
  }, [portfolioTotals])

  const selectedVsAverage = useMemo(() => {
    const revenueShare = portfolioTotals.revenue > 0 ? selectedMetrics.revenue / portfolioTotals.revenue : 0
    const profitShare = portfolioTotals.netProfit > 0 ? selectedMetrics.netProfit / portfolioTotals.netProfit : 0
    return {
      revenueDelta: selectedMetrics.revenue - portfolioAverage.revenue,
      netProfitDelta: selectedMetrics.netProfit - portfolioAverage.netProfit,
      netMarginDelta: selectedMetrics.netMargin - portfolioAverage.netMargin,
      revenueShare,
      profitShare,
    }
  }, [portfolioAverage, portfolioTotals, selectedMetrics])

  const chartData = useMemo(() => {
    const weeksMap = new Map<string, Record<string, string | number>>()
    rankedCompanies.forEach((company) => {
      const dashboard = dashboards[company.id]
      if (!dashboard) return
      dashboard.last_weeks.slice(-weeksToShow).forEach((week) => {
        if (!weeksMap.has(week.week_ending)) weeksMap.set(week.week_ending, { week: week.week_ending })
        weeksMap.get(week.week_ending)![company.id] = metricValue(week, selectedMetric)
      })
    })
    return Array.from(weeksMap.values()).sort((a, b) => String(a.week).localeCompare(String(b.week)))
  }, [dashboards, rankedCompanies, selectedMetric, weeksToShow])

  const bestCompany = rankedCompanies[0] ?? null
  const weakestCompany = useMemo(() => {
    const eligible = rankedCompanies
      .map((company) => ({ company, metrics: getWindowMetrics(dashboards[company.id], weeksToShow) }))
      .filter((item) => item.metrics.weeks.length > 0)
    if (!eligible.length) return null
    return eligible.sort((a, b) => a.metrics.netMargin - b.metrics.netMargin)[0]
  }, [dashboards, rankedCompanies, weeksToShow])

  const selectedAverageDelta = selectedMetrics.netMargin - portfolioAverage.netMargin
  const selectedRevenueRankNote = selectedRank ? `#${selectedRank}` : "—"

  const insights = useMemo(() => {
    const notes: Array<{ tone: "neutral" | "good" | "warn" | "bad"; text: string }> = []
    if (bestCompany) {
      notes.push({
        tone: bestCompany.id === companyId ? "good" : "neutral",
        text: `${bestCompany.name} is the current revenue leader in the selected benchmark window.`,
      })
    }
    if (selectedCompany) {
      notes.push({
        tone:
          selectedAverageDelta >= 0
            ? "good"
            : selectedAverageDelta < -0.02
              ? "bad"
              : "warn",
        text: `${selectedCompany.name} net margin is ${fmtPct(selectedMetrics.netMargin)} which is ${selectedAverageDelta >= 0 ? "above" : "below"} the portfolio average by ${fmtPct(Math.abs(selectedAverageDelta))}.`,
      })
    }
    if (selectedVsAverage.revenueShare > 0) {
      notes.push({
        tone: selectedVsAverage.revenueShare > 0.4 ? "warn" : "neutral",
        text: `${selectedCompany?.name ?? "This company"} contributes ${fmtPct(selectedVsAverage.revenueShare)} of tenant revenue and ${fmtPct(selectedVsAverage.profitShare)} of portfolio net profit.`,
      })
    }
    if (weakestCompany) {
      notes.push({
        tone: "bad",
        text: `${weakestCompany.company.name} is the weakest margin profile at ${fmtPct(weakestCompany.metrics.netMargin)} in the current window.`,
      })
    }
    if (rankedCompanies.filter((company) => (dashboards[company.id]?.last_weeks.length ?? 0) > 0).length <= 2) {
      notes.push({
        tone: "warn",
        text: "This portfolio is still thin, so a small number of active companies is carrying most of the signal.",
      })
    }
    return notes.slice(0, 5)
  }, [bestCompany, companyId, dashboards, rankedCompanies, selectedAverageDelta, selectedCompany, selectedMetrics.netMargin, selectedVsAverage.profitShare, selectedVsAverage.revenueShare, weakestCompany])

  const comparisonRows = useMemo(() => {
    return rankedCompanies.map((company, index) => {
      const dashboard = dashboards[company.id]
      const metrics = getWindowMetrics(dashboard, weeksToShow)
      const revenueShare = portfolioTotals.revenue > 0 ? metrics.revenue / portfolioTotals.revenue : 0
      const profitShare = portfolioTotals.netProfit > 0 ? metrics.netProfit / portfolioTotals.netProfit : 0
      const status =
        !dashboard || metrics.weeks.length === 0
          ? { tone: "warn" as const, label: "Needs reports" }
          : metrics.netMargin >= portfolioAverage.netMargin
            ? { tone: "good" as const, label: "Above avg" }
            : metrics.netMargin < portfolioAverage.netMargin - 0.03
              ? { tone: "bad" as const, label: "Below avg" }
              : { tone: "neutral" as const, label: "Tracking" }
      return { company, metrics, revenueShare, profitShare, status, rank: index + 1 }
    })
  }, [dashboards, portfolioAverage.netMargin, portfolioTotals.netProfit, portfolioTotals.revenue, rankedCompanies, weeksToShow])

  const selectedRangeLabel = rangeOptions.find((option) => option.value === selectedRange)?.label ?? "4 Weeks"

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        label="Portfolio benchmarking"
        title="Company Comparison"
        subtitle="Benchmark the selected company against the full tenant portfolio and see where it is outperforming or falling behind."
      />

      <div className="hidden flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/companies/${companyId}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <h2 className="mt-5 text-5xl font-semibold tracking-tight text-zinc-950">Company Comparison</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
            Benchmark the selected company against the full tenant portfolio and see where it is
            outperforming or falling behind.
          </p>
        </div>
        <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Selected company</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{selectedCompany?.name ?? "Company"}</p>
          <p className="mt-1 text-sm text-zinc-500">Rank {selectedRevenueRankNote} out of {rankedCompanies.length || "—"}</p>
        </div>
      </div>

      {error && <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>}
      {loading && <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm"><p className="text-zinc-500">Loading company comparison...</p></div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Selected company" value={selectedCompany?.name ?? "Company"} subtitle="Current workspace in focus" tone="amber" />
            <Card title="Revenue rank" value={selectedRevenueRankNote} subtitle="Compared across the portfolio window" tone="sky" />
            <Card title="Selected revenue" value={fmtMoney(selectedMetrics.revenue)} subtitle={`Share of portfolio: ${fmtPct(selectedVsAverage.revenueShare)}`} tone={selectedVsAverage.revenueShare > 0.4 ? "emerald" : "default"} />
            <Card title="Selected net margin" value={fmtPct(selectedMetrics.netMargin)} subtitle={`Vs portfolio avg: ${selectedAverageDelta >= 0 ? "+" : ""}${fmtPct(selectedAverageDelta)}`} tone={selectedAverageDelta >= 0 ? "emerald" : "rose"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title="Gap vs portfolio avg revenue" value={selectedVsAverage.revenueDelta >= 0 ? `+${fmtMoney(selectedVsAverage.revenueDelta)}` : fmtMoney(selectedVsAverage.revenueDelta)} subtitle={`Portfolio average: ${fmtMoney(portfolioAverage.revenue)}`} tone={selectedVsAverage.revenueDelta >= 0 ? "emerald" : "amber"} />
            <Card title="Gap vs portfolio avg net margin" value={`${selectedAverageDelta >= 0 ? "+" : ""}${fmtPct(selectedAverageDelta)}`} subtitle={`Portfolio average: ${fmtPct(portfolioAverage.netMargin)}`} tone={selectedAverageDelta >= 0 ? "emerald" : "rose"} />
            <Card
              title="Revenue share of portfolio"
              value={fmtPct(selectedVsAverage.revenueShare)}
              subtitle={bestCompany ? `Leader: ${bestCompany.name}` : "No leader yet"}
              tone="sky"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[30px] border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-zinc-100 px-7 py-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft size={18} className="text-zinc-500" />
                    <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">Portfolio benchmark chart</h3>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-500">Compare the weekly trend for all companies in the tenant.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={selectedRange} onChange={(e) => setSelectedRange(e.target.value as RangeOption)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none">
                    {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value as MetricOption)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 outline-none">
                    {metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-6">
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => selectedMetric === "netMargin" ? fmtPct(Number(value)) : fmtShortMoney(Number(value))} />
                      <Tooltip formatter={(value) => selectedMetric === "netMargin" ? fmtPct(Number(value)) : fmtMoney(Number(value))} contentStyle={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#ffffff" }} />
                      {rankedCompanies.slice(0, 5).map((company, index) => (
                        <Line
                          key={company.id}
                          type="monotone"
                          dataKey={company.id}
                          name={company.name}
                          stroke={company.id === companyId ? "#0f172a" : COLORS[index % COLORS.length]}
                          strokeWidth={company.id === companyId ? 4 : 2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-4 text-sm text-zinc-500">Showing the most recent {selectedRangeLabel.toLowerCase()} of weekly data.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-zinc-500" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Selected vs portfolio average</h3>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-zinc-600">Revenue</p>
                      <p className="text-sm font-semibold text-zinc-950">{fmtMoney(selectedMetrics.revenue)} vs {fmtMoney(portfolioAverage.revenue)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-zinc-950" style={{ width: `${Math.min(100, (selectedMetrics.revenue / Math.max(portfolioAverage.revenue, 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-zinc-600">Net profit</p>
                      <p className="text-sm font-semibold text-zinc-950">{fmtMoney(selectedMetrics.netProfit)} vs {fmtMoney(portfolioAverage.netProfit)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (Math.abs(selectedMetrics.netProfit) / Math.max(Math.abs(portfolioAverage.netProfit), 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-zinc-600">Net margin</p>
                      <p className="text-sm font-semibold text-zinc-950">{fmtPct(selectedMetrics.netMargin)} vs {fmtPct(portfolioAverage.netMargin)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${selectedMetrics.netMargin >= portfolioAverage.netMargin ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, (Math.abs(selectedMetrics.netMargin) / Math.max(Math.abs(portfolioAverage.netMargin), 0.01)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={18} className="text-zinc-500" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Comparison insights</h3>
                </div>
                <div className="mt-5 space-y-3">
                  {insights.map((item) => (
                    <div key={item.text} className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <Badge tone={item.tone}>{item.tone.toUpperCase()}</Badge>
                      <p className="text-sm leading-6 text-zinc-700">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-7 py-6">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-zinc-500" />
                <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">Portfolio comparison table</h3>
              </div>
              <p className="mt-1.5 text-sm text-zinc-500">Benchmarked across the selected window. The selected company is highlighted for easy scanning.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Rank</th>
                    <th className="px-6 py-4 font-medium">Company</th>
                    <th className="px-6 py-4 font-medium">Revenue</th>
                    <th className="px-6 py-4 font-medium">Net Profit</th>
                    <th className="px-6 py-4 font-medium">Net Margin</th>
                    <th className="px-6 py-4 font-medium">Revenue Share</th>
                    <th className="px-6 py-4 font-medium">Profit Share</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const isSelected = row.company.id === companyId
                    const isBest = row.rank === 1
                    return (
                      <tr key={row.company.id} className={`border-t border-zinc-100 transition ${isSelected ? "bg-zinc-950/[0.03]" : "hover:bg-zinc-50/60"}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">{row.rank}</span>
                            {isBest && <Badge tone="good">Leader</Badge>}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-900">
                          <Link href={`/companies/${row.company.id}`} className="flex items-center gap-3 hover:underline">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                              <Building2 size={16} />
                            </div>
                            <span>{row.company.name}</span>
                            {isSelected && <Badge tone="neutral">Selected</Badge>}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-900">{fmtMoney(row.metrics.revenue)}</td>
                        <td className="px-6 py-4">{fmtMoney(row.metrics.netProfit)}</td>
                        <td className="px-6 py-4">{fmtPct(row.metrics.netMargin)}</td>
                        <td className="px-6 py-4">{fmtPct(row.revenueShare)}</td>
                        <td className="px-6 py-4">{fmtPct(row.profitShare)}</td>
                        <td className="px-6 py-4"><Badge tone={row.status.tone}>{row.status.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">Portfolio perspective</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">What this benchmark says</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                {selectedCompany
                  ? `${selectedCompany.name} contributes ${fmtPct(selectedVsAverage.revenueShare)} of tenant revenue and ${fmtPct(selectedVsAverage.profitShare)} of net profit in the selected window.`
                  : "Select a company to see benchmark perspective."}
              </p>
            </div>
            <div className="rounded-[30px] border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Best performer</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{bestCompany?.name ?? "No leader yet"}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {bestCompany ? `Currently leading with ${fmtMoney(getWindowMetrics(dashboards[bestCompany.id], weeksToShow).revenue)} in revenue.` : "Build up activity to surface a top performer."}
              </p>
            </div>
            <div className="rounded-[30px] border border-rose-200 bg-rose-50/80 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">Needs attention</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{weakestCompany?.company.name ?? "No weak signals"}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {weakestCompany ? `Lowest margin company at ${fmtPct(weakestCompany.metrics.netMargin)} in the current window.` : "No company has enough performance history to flag as weakest yet."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
