"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AnalyticsPeriodKey,
  CompanyAnalyticsResponse,
  getCompanyAnalytics,
} from "@/services/api"
import WorkspacePageHeader from "@/components/workspace-page-header"
import { formatDateInput, formatDateLong } from "@/lib/report-utils"
import {
  BudgetPlan,
  BudgetRangeSummary,
  getBudgetRangeSummary,
  loadBudgetPlan,
} from "@/lib/budget-forecast"
import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Compass,
  Flame,
  LineChart as LineChartIcon,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react"

type MetricTone = "default" | "emerald" | "amber" | "rose" | "blue"
type AnalyticsSection = "overview" | "revenue" | "margin" | "budget" | "operations"

const PERIOD_OPTIONS: Array<{ value: AnalyticsPeriodKey; label: string }> = [
  { value: "last-week", label: "Last week" },
  { value: "last-4-weeks", label: "Last 4 weeks" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "last-12-months", label: "Last 12 months" },
  { value: "specific-range", label: "Specific range" },
]

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysAgo(days: number) {
  const d = startOfToday()
  d.setDate(d.getDate() - days)
  return d
}

function parseDateInput(value: string) {
  if (!value) return null
  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function formatPct(value: number | null | undefined) {
  return `${(((value ?? 0) as number) * 100).toFixed(1)}%`
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(value ?? 0)
}

function formatDelta(value: number | null | undefined, unit: "currency" | "percent" | "count" | "ratio") {
  if (value == null) return "-"
  const sign = value > 0 ? "+" : ""
  if (unit === "currency") return `${sign}${formatMoney(value)}`
  if (unit === "percent" || unit === "ratio") return `${sign}${formatPct(value)}`
  return `${sign}${formatCount(value)}`
}

function metricValue(metric: { value?: number | null; unit: "currency" | "percent" | "count" | "ratio" }) {
  if (metric.value == null) return "-"
  if (metric.unit === "currency") return formatMoney(metric.value)
  if (metric.unit === "count") return formatCount(metric.value)
  return formatPct(metric.value)
}

function metricDelta(metric: {
  delta?: number | null
  unit: "currency" | "percent" | "count" | "ratio"
}) {
  if (metric.delta == null) return null
  return `${formatDelta(metric.delta, metric.unit)} vs previous`
}

function sectionIconTone(tone: MetricTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "blue":
      return "border-sky-200 bg-sky-50 text-sky-700"
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700"
  }
}

function severityTone(severity: CompanyAnalyticsResponse["insights"][number]["severity"]) {
  switch (severity) {
    case "critical":
      return {
        container: "border-rose-200 bg-rose-50/80 text-rose-900",
        label: "Critical",
        accent: "bg-rose-500",
      }
    case "warning":
      return {
        container: "border-amber-200 bg-amber-50/80 text-amber-900",
        label: "Warning",
        accent: "bg-amber-500",
      }
    case "success":
      return {
        container: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
        label: "Opportunity",
        accent: "bg-emerald-500",
      }
    default:
      return {
        container: "border-sky-200 bg-sky-50/80 text-sky-900",
        label: "Insight",
        accent: "bg-sky-500",
      }
  }
}

function deltaChipTone(delta?: number | null) {
  if (delta == null) return "border-zinc-200 bg-zinc-50 text-zinc-500"
  return delta >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
}

function metricGroupTone(title: string) {
  if (title === "Profitability") return "border-sky-200 bg-sky-50/70"
  if (title === "Revenue quality") return "border-emerald-200 bg-emerald-50/70"
  if (title === "Forecasting") return "border-amber-200 bg-amber-50/70"
  return "border-zinc-200 bg-zinc-50/70"
}

function ExecutiveMetricCard({
  title,
  value,
  subtitle,
  tone = "default",
  delta,
  icon,
}: {
  title: string
  value: string
  subtitle: string
  tone?: MetricTone
  delta?: string | null
  icon?: ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{title}</p>
          <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-zinc-950 md:text-[2.25rem]">
            {value}
          </p>
        </div>
        {icon ? <div className={`rounded-2xl border p-2 ${sectionIconTone(tone)}`}>{icon}</div> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {delta ? (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${deltaChipTone(delta.startsWith("-") ? -1 : 1)}`}>
            {delta}
          </span>
        ) : null}
        <p className="text-sm leading-6 text-zinc-500">{subtitle}</p>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-[32px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${className ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 md:text-[1.95rem]">
            {title}
          </h2>
          {subtitle ? <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function PriorityInsightCard({
  insight,
}: {
  insight: CompanyAnalyticsResponse["insights"][number]
}) {
  const tone = severityTone(insight.severity)

  return (
    <div className={`rounded-[28px] border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${tone.container}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">{tone.label}</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight">{insight.title}</h3>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone.accent}`} />
      </div>

      <p className="mt-3 text-sm leading-6 opacity-90">{insight.summary}</p>

      <div className="mt-4 rounded-2xl border border-current/10 bg-white/60 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Recommended action</p>
        <p className="mt-1.5 text-sm leading-6 opacity-90">{insight.recommended_action}</p>
      </div>

      {insight.evidence.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {insight.evidence.slice(0, 3).map((line) => (
            <span key={line} className="rounded-full border border-current/10 bg-white/50 px-2.5 py-1 text-[11px] font-medium">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ChangeCard({
  title,
  delta,
  subtitle,
}: {
  title: string
  delta?: string | null
  subtitle: string
}) {
  const positive = typeof delta === "string" && !delta.startsWith("-")

  return (
    <div className="rounded-[28px] border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      <p className={`mt-3 text-[2rem] font-semibold tracking-[-0.05em] ${positive ? "text-emerald-700" : "text-rose-700"}`}>
        {delta ?? "-"}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
    </div>
  )
}

function MetricGroupCard({
  title,
  description,
  metrics,
}: {
  title: string
  description: string
  metrics: Array<{
    key: string
    label: string
    value: string
    subtitle: string
    tone: MetricTone
  }>
}) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${metricGroupTone(title)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Secondary
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{metric.label}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-950">{metric.value}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{metric.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-500">
      <p className="font-semibold text-zinc-800">{title}</p>
      <p className="mt-1.5 leading-6">{body}</p>
    </div>
  )
}

function buildWindow(period: AnalyticsPeriodKey, specificStart: string, specificEnd: string) {
  const today = startOfToday()

  const build = (days: number, label: string) => {
    const end = today
    const start = daysAgo(days - 1)
    return {
      valid: true,
      period,
      label,
      start,
      end,
      startDate: formatDateInput(start),
      endDate: formatDateInput(end),
    }
  }

  switch (period) {
    case "last-week":
      return build(7, "Last week")
    case "last-4-weeks":
      return build(28, "Last 4 weeks")
    case "last-3-months":
      return build(90, "Last 3 months")
    case "last-6-months":
      return build(180, "Last 6 months")
    case "last-12-months":
      return build(365, "Last 12 months")
    case "specific-range": {
      const start = parseDateInput(specificStart)
      const end = parseDateInput(specificEnd)
      if (!start || !end || start > end) {
        return {
          valid: false,
          period,
          label: "Specific range",
          start: today,
          end: today,
          startDate: specificStart,
          endDate: specificEnd,
        }
      }
      return {
        valid: true,
        period,
        label: "Specific range",
        start,
        end,
        startDate: formatDateInput(start),
        endDate: formatDateInput(end),
      }
    }
    default:
      return build(28, "Last 4 weeks")
  }
}

function buildKpiTiles(analytics: CompanyAnalyticsResponse | null, budget: BudgetRangeSummary | null) {
  const tiles: Array<{
    key: string
    label: string
    value: string
    subtitle: string
    delta?: string | null
    tone: MetricTone
    icon?: ReactNode
  }> = []

  const byKey = new Map(analytics?.kpis.map((metric) => [metric.key, metric]) ?? [])
  const actualRevenue = analytics?.summary.revenue_ex_vat
  const actualNetProfit = analytics?.summary.net_profit
  const annualRevenue = analytics?.summary.annualized_revenue_ex_vat
  const annualNetProfit = analytics?.summary.annualized_net_profit
  const pushMetric = (key: string, tone: MetricTone, icon?: ReactNode) => {
    const metric = byKey.get(key)
    if (!metric || !metric.available) return
    tiles.push({
      key,
      label: metric.label,
      value: metricValue(metric),
      subtitle:
        metric.key === "revenue_ex_vat"
          ? "Primary revenue signal for the selected period"
          : metric.key === "gross_profit"
            ? "Revenue before labour and overheads"
            : metric.key === "net_profit"
              ? "Bottom-line profit after all operating costs"
              : metric.key === "gross_margin_pct"
                ? "Gross profit converted into percentage margin"
                : metric.key === "net_margin_pct"
                  ? "Profit conversion after all costs"
                  : metric.key === "labour_pct"
                    ? "Wages plus holiday pay as a share of revenue"
                    : metric.key === "food_cost_pct"
                      ? "Ingredient and consumable cost as a share of revenue"
                      : metric.key === "average_weekly_revenue"
                        ? "Average weekly revenue inside the selected period"
                        : metric.key === "average_weekly_profit"
                          ? "Average weekly profit inside the selected period"
                          : metric.key === "average_order_value"
                            ? "Average basket value ex VAT"
                            : metric.key === "ledger_revenue_ex_vat"
                              ? "Invoice-ledger revenue for the same period"
                              : metric.key === "annualized_revenue_ex_vat"
                                ? "Run-rate projection if this pace continues"
                                : "Projected annual net profit at the current pace",
      delta: metric.delta == null ? null : metricDelta(metric),
      tone,
      icon,
    })
  }

  pushMetric("revenue_ex_vat", "emerald", <CircleDollarSign size={18} />)
  pushMetric("gross_profit", "blue", <TrendingUp size={18} />)
  pushMetric("net_profit", "rose", <Flame size={18} />)
  pushMetric("gross_margin_pct", "amber", <LineChartIcon size={18} />)
  pushMetric("net_margin_pct", "emerald", <Target size={18} />)
  pushMetric("labour_pct", "rose", <Users size={18} />)
  pushMetric("food_cost_pct", "amber", <ShoppingCart size={18} />)
  pushMetric("average_weekly_revenue", "blue", <BarChart3 size={18} />)
  pushMetric("average_weekly_profit", "blue", <BarChart3 size={18} />)
  pushMetric("average_order_value", "default", <Compass size={18} />)
  pushMetric("ledger_revenue_ex_vat", "default", <Warehouse size={18} />)
  pushMetric("annualized_revenue_ex_vat", "blue", <TrendingUp size={18} />)
  pushMetric("annualized_net_profit", "rose", <Flame size={18} />)

  if (budget) {
    tiles.push(
      {
        key: "variance-vs-budget-revenue",
        label: "Variance vs Budget",
        value: actualRevenue != null ? formatMoney(actualRevenue - budget.revenue) : "-",
        subtitle: "Selected period revenue against the allocated budget window",
        tone: "amber",
        icon: <Target size={18} />,
      },
      {
        key: "variance-vs-budget-profit",
        label: "Variance vs Budget Net Profit",
        value: actualNetProfit != null ? formatMoney(actualNetProfit - budget.netProfit) : "-",
        subtitle: "Selected period profit against the allocated budget window",
        tone: "rose",
        icon: <Flame size={18} />,
      },
      {
        key: "variance-vs-forecast-revenue",
        label: "Variance vs Forecast",
        value: annualRevenue != null ? formatMoney(annualRevenue - budget.annualRevenueTarget) : "-",
        subtitle: "Run-rate revenue versus the annual forecast",
        tone: "blue",
        icon: <TrendingUp size={18} />,
      },
      {
        key: "variance-vs-forecast-profit",
        label: "Variance vs Forecast Net Profit",
        value: annualNetProfit != null ? formatMoney(annualNetProfit - budget.annualNetProfitTarget) : "-",
        subtitle: "Run-rate profit versus the annual forecast",
        tone: "emerald",
        icon: <Target size={18} />,
      }
    )
  }

  return tiles
}

export default function CompanyAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [period, setPeriod] = useState<AnalyticsPeriodKey>("last-4-weeks")
  const [specificStartDraft, setSpecificStartDraft] = useState(() => formatDateInput(daysAgo(27)))
  const [specificEndDraft, setSpecificEndDraft] = useState(() => formatDateInput(startOfToday()))
  const [appliedSpecificStart, setAppliedSpecificStart] = useState(() => formatDateInput(daysAgo(27)))
  const [appliedSpecificEnd, setAppliedSpecificEnd] = useState(() => formatDateInput(startOfToday()))
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("overview")
  const [analytics, setAnalytics] = useState<CompanyAnalyticsResponse | null>(null)
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedWindow = useMemo(
    () => buildWindow(period, appliedSpecificStart, appliedSpecificEnd),
    [period, appliedSpecificStart, appliedSpecificEnd]
  )

  useEffect(() => {
    if (period !== "specific-range") return
    if (!specificStartDraft || !specificEndDraft) {
      const start = formatDateInput(daysAgo(27))
      const end = formatDateInput(startOfToday())
      setSpecificStartDraft(start)
      setSpecificEndDraft(end)
      setAppliedSpecificStart(start)
      setAppliedSpecificEnd(end)
    }
  }, [period, specificStartDraft, specificEndDraft])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!analytics?.period.end_date) {
      setBudgetPlan(null)
      return
    }
    const year = new Date(analytics.period.end_date).getFullYear()
    setBudgetPlan(loadBudgetPlan(companyId, year))
  }, [analytics?.period.end_date, companyId])

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      if (!selectedWindow.valid) {
        setAnalytics(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const data = await getCompanyAnalytics(companyId, {
          period: selectedWindow.period,
          startDate: selectedWindow.period === "specific-range" ? selectedWindow.startDate : undefined,
          endDate: selectedWindow.period === "specific-range" ? selectedWindow.endDate : undefined,
        })

        if (!active) return
        setAnalytics(data)
      } catch (err) {
        if (!active) return
        const message = err instanceof Error ? err.message : "Failed to load analytics."
        const lower = message.toLowerCase()
        if (
          lower.includes("session expired") ||
          lower.includes("401") ||
          lower.includes("missing bearer token") ||
          lower.includes("invalid token")
        ) {
          router.replace("/login")
          return
        }
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAnalytics()

    return () => {
      active = false
    }
  }, [
    companyId,
    router,
    selectedWindow.endDate,
    selectedWindow.period,
    selectedWindow.startDate,
    selectedWindow.valid,
  ])

  const budgetSummary = useMemo(() => {
    if (!budgetPlan || !selectedWindow.valid) return null
    return getBudgetRangeSummary(budgetPlan, selectedWindow.start, selectedWindow.end)
  }, [budgetPlan, selectedWindow])

  const displayMetrics = useMemo(() => buildKpiTiles(analytics, budgetSummary), [analytics, budgetSummary])
  const primaryMetricKeys = useMemo(
    () => new Set(["revenue_ex_vat", "net_profit", "net_margin_pct", "food_cost_pct", "labour_pct"]),
    []
  )
  const primaryMetrics = useMemo(
    () => displayMetrics.filter((metric) => primaryMetricKeys.has(metric.key)).slice(0, 5),
    [displayMetrics, primaryMetricKeys]
  )
  const secondaryMetrics = useMemo(
    () => displayMetrics.filter((metric) => !primaryMetricKeys.has(metric.key)),
    [displayMetrics, primaryMetricKeys]
  )
  const secondaryMetricGroups = useMemo(() => {
    const groups = [
      {
        title: "Profitability",
        description: "Gross profit and margin depth behind the headline result.",
        keys: ["gross_profit", "gross_margin_pct"],
      },
      {
        title: "Revenue quality",
        description: "Basket value, average pace, and ledger-led revenue context.",
        keys: ["average_weekly_revenue", "average_weekly_profit", "average_order_value", "ledger_revenue_ex_vat"],
      },
      {
        title: "Forecasting",
        description: "Annualized pace and budget / forecast variance checks.",
        keys: [
          "annualized_revenue_ex_vat",
          "annualized_net_profit",
          "variance-vs-budget-revenue",
          "variance-vs-budget-profit",
          "variance-vs-forecast-revenue",
          "variance-vs-forecast-profit",
        ],
      },
    ]

    return groups
      .map((group) => ({
        ...group,
        metrics: secondaryMetrics.filter((metric) => group.keys.includes(metric.key)),
      }))
      .filter((group) => group.metrics.length > 0)
  }, [secondaryMetrics])

  const revenueTrend = analytics?.sales_trend ?? []
  const marginTrend = analytics?.weekly_trend ?? []
  const weeklyTrendPoints = marginTrend
  const compressionPeriods = useMemo(() => {
    if (!weeklyTrendPoints.length) return []
    const items: Array<{
      label: string
      from: number
      to: number
      grossMargin: number
      netMargin: number
    }> = []

    weeklyTrendPoints.forEach((point, index) => {
      if (index === 0) return
      const previous = weeklyTrendPoints[index - 1]
      if (
        previous.net_margin_pct == null ||
        point.net_margin_pct == null ||
        previous.gross_margin_pct == null ||
        point.gross_margin_pct == null
      ) {
        return
      }

      if (point.net_margin_pct <= previous.net_margin_pct - 0.03 || point.gross_margin_pct <= previous.gross_margin_pct - 0.03) {
        items.push({
          label: point.label,
          from: previous.net_margin_pct,
          to: point.net_margin_pct,
          grossMargin: point.gross_margin_pct,
          netMargin: point.net_margin_pct,
        })
      }
    })

    return items.slice(-3)
  }, [weeklyTrendPoints])

  const topProducts = analytics?.top_products ?? []
  const topRevenueCategories = analytics?.top_revenue_categories ?? []
  const topCostCategories = analytics?.top_cost_categories ?? []
  const topSuppliers = analytics?.top_suppliers ?? []

  const weakestDays = useMemo(() => {
    const dayHighlights = analytics?.highlights.filter((item) => item.kind === "day") ?? []
    return dayHighlights.filter((item) => item.direction === "worst").slice(0, 3)
  }, [analytics?.highlights])

  const weakWeeks = useMemo(() => {
    const trend = analytics?.weekly_trend ?? []
    return [...trend]
      .filter((point) => point.net_profit != null)
      .sort((a, b) => (a.net_profit ?? 0) - (b.net_profit ?? 0))
      .slice(0, 3)
  }, [analytics?.weekly_trend])

  const budgetInsights = useMemo(() => {
    if (!budgetSummary || !analytics) return []

    const insights: CompanyAnalyticsResponse["insights"] = []
    const revenue = analytics.summary.revenue_ex_vat ?? 0
    const annualRevenue = analytics.summary.annualized_revenue_ex_vat ?? 0
    const annualNetProfit = analytics.summary.annualized_net_profit ?? 0

    if (revenue > 0 && budgetSummary.revenue > 0) {
      const variance = revenue - budgetSummary.revenue
      if (Math.abs(variance) > budgetSummary.revenue * 0.05) {
        insights.push({
          key: "budget-revenue-variance",
          severity: variance >= 0 ? "success" : "warning",
          title: variance >= 0 ? "Revenue is ahead of budget" : "Revenue is below budget pace",
          summary: `Selected-period revenue is ${formatMoney(Math.abs(variance))} ${variance >= 0 ? "ahead" : "behind"} the budgeted window.`,
          why_it_matters: "Budget variance shows whether the current period is tracking to plan or slipping out of pace.",
          recommended_action: variance >= 0
            ? "Protect the upside by keeping labour and food cost discipline tight."
            : "Check whether the gap is caused by fewer invoices or a weaker basket mix.",
          evidence: [
            `Budget: ${formatMoney(budgetSummary.revenue)}`,
            `Actual: ${formatMoney(revenue)}`,
          ],
        })
      }
    }

    if (annualRevenue > 0 && budgetSummary.annualRevenueTarget > 0) {
      const variance = annualRevenue - budgetSummary.annualRevenueTarget
      if (Math.abs(variance) > budgetSummary.annualRevenueTarget * 0.05) {
        insights.push({
          key: "forecast-revenue-variance",
          severity: variance >= 0 ? "success" : "critical",
          title: variance >= 0 ? "Run-rate is ahead of forecast" : "Current pace suggests a year-end shortfall",
          summary: `Annualized revenue is ${formatMoney(Math.abs(variance))} ${variance >= 0 ? "above" : "below"} the annual forecast.`,
          why_it_matters: "Run-rate tells you where the business will land if the current pace continues.",
          recommended_action: variance >= 0
            ? "Keep the momentum but watch for margin leakage as sales grow."
            : "Adjust pricing, product mix, or operating efficiency to close the gap early.",
          evidence: [
            `Forecast: ${formatMoney(budgetSummary.annualRevenueTarget)}`,
            `Run-rate: ${formatMoney(annualRevenue)}`,
          ],
        })
      }
    }

    if (annualNetProfit > 0 && budgetSummary.annualNetProfitTarget > 0) {
      const variance = annualNetProfit - budgetSummary.annualNetProfitTarget
      if (Math.abs(variance) > budgetSummary.annualNetProfitTarget * 0.05) {
        insights.push({
          key: "forecast-profit-variance",
          severity: variance >= 0 ? "success" : "critical",
          title: variance >= 0 ? "Profit run-rate is ahead of forecast" : "Profit run-rate is below forecast",
          summary: `Projected annual profit is ${formatMoney(Math.abs(variance))} ${variance >= 0 ? "ahead" : "behind"} forecast.`,
          why_it_matters: "A profit gap usually means margin leakage is compounding across the full year.",
          recommended_action: variance >= 0
            ? "Bank the gains and keep an eye on the highest-cost lines."
            : "Focus on labour, food cost, and low-margin products before the gap gets wider.",
          evidence: [
            `Forecast: ${formatMoney(budgetSummary.annualNetProfitTarget)}`,
            `Run-rate: ${formatMoney(annualNetProfit)}`,
          ],
        })
      }
    }

    return insights
  }, [analytics, budgetSummary])

  const dataQualityInsights = useMemo(() => {
    if (!analytics) return []

    const items: CompanyAnalyticsResponse["insights"] = []
    const purchaseCoverage = analytics.coverage.purchase_lines ?? 0
    const costCategories = topCostCategories.length

    if (purchaseCoverage > 0 && costCategories === 0) {
      items.push({
        key: "uncategorised-costs",
        severity: "warning",
        title: "Cost categorisation is too thin",
        summary: "Purchase data exists, but the cost-side analysis is still too sparse to produce strong margin signals.",
        why_it_matters: "Without cost categorisation, margin pressure can hide behind aggregated spend lines.",
        recommended_action: "Review purchase mapping and category assignment so spend rolls into meaningful cost groups.",
        evidence: [`Purchase lines: ${formatCount(purchaseCoverage)}`, "Top cost categories: 0"],
      })
    }

    return items
  }, [analytics, topCostCategories.length])

  const combinedInsights = useMemo(
    () => [...dataQualityInsights, ...(analytics?.insights ?? []), ...budgetInsights],
    [analytics?.insights, budgetInsights, dataQualityInsights]
  )

  const overviewInsights = useMemo(() => {
    const prioritized: CompanyAnalyticsResponse["insights"] = []
    const used = new Set<string>()
    const pick = (severity: CompanyAnalyticsResponse["insights"][number]["severity"]) => {
      const insight = combinedInsights.find((item) => item.severity === severity && !used.has(item.key))
      if (insight) {
        prioritized.push(insight)
        used.add(insight.key)
      }
    }

    pick("critical")
    pick("warning")
    pick("success")

    combinedInsights.forEach((insight) => {
      if (prioritized.length >= 3) return
      if (used.has(insight.key)) return
      prioritized.push(insight)
      used.add(insight.key)
    })

    return prioritized.slice(0, 3)
  }, [combinedInsights])

  const changeSummaryMetrics = useMemo(
    () => primaryMetrics.filter((metric) => metric.delta != null).slice(0, 3),
    [primaryMetrics]
  )

  const labourChartReady = useMemo(
    () => analytics?.weekly_trend.some((point) => (point.labour_pct ?? 0) > 0) ?? false,
    [analytics?.weekly_trend]
  )

  const bestPeriod = analytics?.highlights.find((item) => item.direction === "best") ?? analytics?.highlights[0] ?? null
  const weakestPeriod = analytics?.highlights.find((item) => item.direction === "worst") ?? weakWeeks[0] ?? null

  const selectedRangeLabel = useMemo(() => {
    if (!selectedWindow.valid) return "Invalid range"
    return `${selectedWindow.label} - ${formatDateLong(selectedWindow.start)} -> ${formatDateLong(selectedWindow.end)}`
  }, [selectedWindow])

  const healthSnapshot = useMemo(() => {
    const criticalCount = combinedInsights.filter((item) => item.severity === "critical").length
    const warningCount = combinedInsights.filter((item) => item.severity === "warning").length

    if (criticalCount > 0) {
      return {
        label: "Needs attention",
        tone: "rose" as const,
        description: `${criticalCount} critical signal${criticalCount === 1 ? "" : "s"} in the current window.`,
      }
    }

    if (warningCount > 0) {
      return {
        label: "Watch closely",
        tone: "amber" as const,
        description: `${warningCount} warning signal${warningCount === 1 ? "" : "s"} to review.`,
      }
    }

    return {
      label: "Healthy week",
      tone: "emerald" as const,
      description: "No critical signals are currently flagged in this period.",
    }
  }, [combinedInsights])

  const sectionTabs: Array<{ key: AnalyticsSection; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "revenue", label: "Revenue" },
    { key: "margin", label: "Margin" },
    { key: "budget", label: "Budget / Forecast" },
    { key: "operations", label: "Operations" },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <WorkspacePageHeader
          compact
          label="Company intelligence"
          title="Analytics"
          subtitle={`Actionable operating intelligence for ${analytics?.company_name ?? "this company"}.`}
          companyName={analytics?.company_name ?? "Loading..."}
          companyMeta={selectedRangeLabel}
          companyBadge={
            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {analytics ? `${analytics.coverage.weekly_reports} reports - ${analytics.coverage.sales_invoices} invoices` : "Live data"}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-end gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Period</p>
                <div className="mt-2 flex items-center gap-2">
                  <ChevronDown size={15} className="text-zinc-400" />
                  <select
                    value={period}
                    onChange={(e) => {
                      const next = e.target.value as AnalyticsPeriodKey
                      setPeriod(next)
                      if (next === "specific-range") {
                        const start = formatDateInput(daysAgo(27))
                        const end = formatDateInput(startOfToday())
                        setSpecificStartDraft(start)
                        setSpecificEndDraft(end)
                        setAppliedSpecificStart(start)
                        setAppliedSpecificEnd(end)
                      }
                    }}
                    className="border-none bg-transparent text-sm font-medium text-zinc-800 outline-none"
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {period === "specific-range" ? (
                <>
                  <label className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      From
                    </span>
                    <input
                      type="date"
                      value={specificStartDraft}
                      onChange={(e) => setSpecificStartDraft(e.target.value)}
                      className="mt-2 border-none bg-transparent p-0 text-sm font-medium text-zinc-800 outline-none"
                    />
                  </label>
                  <label className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      To
                    </span>
                    <input
                      type="date"
                      value={specificEndDraft}
                      onChange={(e) => setSpecificEndDraft(e.target.value)}
                      className="mt-2 border-none bg-transparent p-0 text-sm font-medium text-zinc-800 outline-none"
                    />
                  </label>
                  <button
                    onClick={() => {
                      if (!specificStartDraft || !specificEndDraft) return
                      const start = parseDateInput(specificStartDraft)
                      const end = parseDateInput(specificEndDraft)
                      if (!start || !end || start > end) {
                        setError("Please choose a valid date range.")
                        return
                      }
                      setError(null)
                      setAppliedSpecificStart(formatDateInput(start))
                      setAppliedSpecificEnd(formatDateInput(end))
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-900"
                  >
                    <RefreshCw size={15} />
                    Apply range
                  </button>
                </>
              ) : null}
            </div>
          }
        />
      </div>

      {error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : null}

      {!loading && analytics ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {primaryMetrics.map((metric) => (
              <ExecutiveMetricCard
                key={metric.key}
                title={metric.label}
                value={metric.value}
                subtitle={metric.subtitle}
                tone={metric.tone}
                delta={metric.delta}
                icon={metric.icon}
              />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <SectionCard title="What matters now" subtitle="Priority signals that deserve attention today.">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {overviewInsights.length > 0 ? (
                    overviewInsights.map((insight) => <PriorityInsightCard key={insight.key} insight={insight} />)
                  ) : (
                    <div className="lg:col-span-3">
                      <EmptyState
                        title="No priority insights yet"
                        body="This usually means the selected period is too sparse to generate a clear operating signal."
                      />
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="What changed" subtitle="Primary movement versus the previous period.">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {changeSummaryMetrics.map((metric) => (
                    <ChangeCard key={metric.key} title={metric.label} delta={metric.delta} subtitle={metric.subtitle} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Secondary metrics" subtitle="Lower-priority metrics grouped by business area.">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {secondaryMetricGroups.map((group) => (
                    <MetricGroupCard
                      key={group.title}
                      title={group.title}
                      description={group.description}
                      metrics={group.metrics}
                    />
                  ))}
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <SectionCard
                title="Executive snapshot"
                subtitle="Health, coverage and the strongest recommendation."
                className="xl:shadow-[0_16px_40px_rgba(15,23,42,0.04)]"
              >
                <div
                  className={`rounded-[24px] border p-4 ${
                    healthSnapshot.tone === "emerald"
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                      : healthSnapshot.tone === "amber"
                        ? "border-amber-200 bg-amber-50/70 text-amber-900"
                        : "border-rose-200 bg-rose-50/70 text-rose-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">Health status</p>
                      <p className="mt-2 text-lg font-semibold tracking-tight">{healthSnapshot.label}</p>
                    </div>
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        healthSnapshot.tone === "emerald"
                          ? "bg-emerald-500"
                          : healthSnapshot.tone === "amber"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 opacity-90">{healthSnapshot.description}</p>
                </div>

                <div className="mt-4 rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Strongest recommendation</p>
                  {overviewInsights[0] ? (
                    <>
                      <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-950">{overviewInsights[0].title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{overviewInsights[0].recommended_action}</p>
                      {overviewInsights[0].evidence.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {overviewInsights[0].evidence.slice(0, 2).map((line) => (
                            <span
                              key={line}
                              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600"
                            >
                              {line}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-zinc-500">No recommendation is available yet for this period.</p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-zinc-200/70 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Best period</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">{bestPeriod?.label ?? "-"}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {bestPeriod ? `${formatMoney(bestPeriod.revenue_ex_vat)} revenue ex VAT` : "No highlight yet"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-zinc-200/70 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Weakest period</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">{weakestPeriod?.label ?? "-"}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {weakestPeriod ? `${formatMoney(weakestPeriod.revenue_ex_vat)} revenue ex VAT` : "No weak window yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-zinc-200/70 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Coverage</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Reports</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.weekly_reports)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Invoices</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.sales_invoices)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Matched</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.matched_products)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Purchases</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.purchase_lines)}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </aside>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {sectionTabs.map((tab) => {
                const active = activeSection === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSection(tab.key)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-transparent bg-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {activeSection === "overview" ? (
            <SectionCard title="Trend overview" subtitle="How the selected period is moving across revenue, margin and operational pressure.">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Revenue trend</h3>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">Revenue ex VAT over the selected period.</p>
                  <div className="mt-5 h-[250px]">
                    {revenueTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueTrend}>
                          <defs>
                            <linearGradient id="analyticsRevenueFillOverview" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#18181b" stopOpacity={0.16} />
                              <stop offset="95%" stopColor="#18181b" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
                          <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => formatMoney(value as number)} />
                          <Tooltip
                            formatter={(value: number | string | undefined) => formatMoney(Number(value ?? 0))}
                            labelFormatter={(label) => String(label)}
                            contentStyle={{
                              borderRadius: 16,
                              border: "1px solid #e4e4e7",
                              background: "#ffffff",
                            }}
                          />
                          <Area type="monotone" dataKey="revenue_ex_vat" stroke="#18181b" fill="url(#analyticsRevenueFillOverview)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="No sales trend available"
                        body="Revenue trend data will appear once the selected period contains invoices."
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp size={18} className="text-zinc-500" />
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Margin pulse</h3>
                    </div>
                    <div className="mt-4 h-[180px]">
                      {weeklyTrendPoints.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weeklyTrendPoints}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                            <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
                            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => formatPct(Number(value))} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => formatPct(Number(value ?? 0))}
                              labelFormatter={(label) => String(label)}
                              contentStyle={{
                                borderRadius: 16,
                                border: "1px solid #e4e4e7",
                                background: "#ffffff",
                              }}
                            />
                            <Line type="monotone" dataKey="gross_margin_pct" stroke="#0f172a" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="net_margin_pct" stroke="#16a34a" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="labour_pct" stroke="#e11d48" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState
                          title="No weekly margin data yet"
                          body="Weekly reports are needed to plot gross and net margin behaviour."
                        />
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <Compass size={18} className="text-zinc-500" />
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Fast read</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-zinc-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Best week</p>
                        <p className="mt-1 text-base font-semibold text-zinc-950">{bestPeriod?.label ?? "-"}</p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Weakest week</p>
                        <p className="mt-1 text-base font-semibold text-zinc-950">{weakestPeriod?.label ?? "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Revenue Intelligence"
            subtitle="Revenue trend, best and weakest periods, and the product mix driving sales."
            className={activeSection !== "revenue" ? "hidden" : ""}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-zinc-500" />
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Revenue trend</h3>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Revenue ex VAT over the selected period. The granularity changes automatically with the period length.
                </p>
                <div className="mt-5 h-[220px]">
                  {revenueTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrend}>
                        <defs>
                          <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.16} />
                            <stop offset="95%" stopColor="#18181b" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => formatMoney(value as number)} />
                        <Tooltip
                          formatter={(value: number | string | undefined) => formatMoney(Number(value ?? 0))}
                          labelFormatter={(label) => String(label)}
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid #e4e4e7",
                            background: "#ffffff",
                          }}
                        />
                        <Area type="monotone" dataKey="revenue_ex_vat" stroke="#18181b" fill="url(#analyticsRevenueFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No sales trend available"
                      body="Revenue trend data will appear once the selected period contains invoices."
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Best and weakest periods</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {analytics.highlights.length > 0 ? (
                      analytics.highlights.slice(0, 6).map((item) => (
                        <div key={item.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                {item.direction}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-zinc-950">{item.label}</p>
                            </div>
                            <p className="text-sm font-semibold text-zinc-700">{formatMoney(item.revenue_ex_vat)}</p>
                          </div>
                          <p className="mt-2 text-sm text-zinc-500">
                            {item.kind === "day"
                              ? "Daily revenue in the selected period"
                              : item.kind === "week"
                                ? "Weekly operating window"
                                : "Monthly revenue window"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No highlights yet"
                        body="The period needs enough revenue and weekly report coverage before best and weakest periods can be identified."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Top products</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topProducts.length > 0 ? (
                      topProducts.slice(0, 5).map((item) => (
                        <div key={`${item.item_name}-${item.rank}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-950">{item.item_name}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {formatCount(item.quantity_sold)} sold - {formatPct(item.revenue_share)} of revenue
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-zinc-700">{formatMoney(item.revenue_ex_vat)}</p>
                          </div>
                          {item.matched_recipe_name ? (
                            <p className="mt-2 text-xs text-zinc-500">
                              Matched recipe margin {formatPct(item.estimated_recipe_margin_pct)} - {item.matched_category ?? "Uncategorised"}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-zinc-400">No recipe match yet</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No product ranking yet"
                        body="Zoho item sales are needed before product performance can be ranked."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Target size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Top categories</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topRevenueCategories.length > 0 ? (
                      topRevenueCategories.slice(0, 5).map((item) => (
                        <div key={`${item.label}-${item.rank}`} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                            <p className="text-xs text-zinc-500">{formatPct(item.share)} of revenue</p>
                          </div>
                          <p className="text-sm font-semibold text-zinc-700">{formatMoney(item.value)}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No category mix yet"
                        body="Recipe matching and item naming are needed before category revenue can be rolled up."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Margin Intelligence"
            subtitle="Gross margin, net margin, labour, food cost, and where compression appears."
            className={activeSection !== "margin" ? "hidden" : ""}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex items-center gap-3">
                  <LineChartIcon size={18} className="text-zinc-500" />
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Margin trend</h3>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Weekly gross margin, net margin, labour, and food cost signals.
                </p>
                <div className="mt-5 h-[220px]">
                  {weeklyTrendPoints.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyTrendPoints}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => formatPct(Number(value))} />
                        <Tooltip
                          formatter={(value: number | string | undefined) => formatPct(Number(value ?? 0))}
                          labelFormatter={(label) => String(label)}
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid #e4e4e7",
                            background: "#ffffff",
                          }}
                        />
                        <Line type="monotone" dataKey="gross_margin_pct" stroke="#0f172a" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="net_margin_pct" stroke="#16a34a" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="labour_pct" stroke="#e11d48" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="food_cost_pct" stroke="#d97706" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No weekly margin data yet"
                      body="Weekly reports are needed to plot gross and net margin behaviour."
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Flame size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Margin compression periods</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {compressionPeriods.length > 0 ? (
                      compressionPeriods.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-semibold text-amber-900">{item.label}</p>
                          <p className="mt-1 text-sm text-amber-800">
                            Net margin moved from {formatPct(item.from)} to {formatPct(item.to)}.
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No compression detected"
                        body="The selected weekly trend does not show a large enough margin step-down to flag a compression window."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Top cost categories</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topCostCategories.length > 0 ? (
                      topCostCategories.slice(0, 5).map((item) => (
                        <div key={`${item.label}-${item.rank}`} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                            <p className="text-xs text-zinc-500">{formatPct(item.share)} of spend</p>
                          </div>
                          <p className="text-sm font-semibold text-zinc-700">{formatMoney(item.value)}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No purchase cost data yet"
                        body="Purchase invoices are required to surface cost categories and supplier concentration."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Warehouse size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Top suppliers</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topSuppliers.length > 0 ? (
                      topSuppliers.slice(0, 5).map((item) => (
                        <div key={`${item.label}-${item.rank}`} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                            <p className="text-xs text-zinc-500">{formatPct(item.share)} of purchase spend</p>
                          </div>
                          <p className="text-sm font-semibold text-zinc-700">{formatMoney(item.value)}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No supplier concentration yet"
                        body="Supplier data will appear once purchase invoices are recorded."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Budget / Forecast Tracking"
            subtitle="Compare actuals to the budget plan in this browser, and to the run-rate projection from live MarginFlow data."
            className={activeSection !== "budget" ? "hidden" : ""}
          >
            {budgetSummary ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ExecutiveMetricCard
                  title="Budgeted revenue"
                  value={formatMoney(budgetSummary.revenue)}
                  subtitle="Selected period allocation from the annual plan"
                  tone="amber"
                  icon={<Target size={18} />}
                />
                <ExecutiveMetricCard
                  title="Budget variance"
                  value={formatMoney((analytics.summary.revenue_ex_vat ?? 0) - budgetSummary.revenue)}
                  subtitle="Actual revenue minus budgeted period revenue"
                  tone="blue"
                  icon={<TrendingUp size={18} />}
                />
                <ExecutiveMetricCard
                  title="Forecast revenue"
                  value={formatMoney(analytics.summary.annualized_revenue_ex_vat ?? 0)}
                  subtitle="Annualized run-rate based on the selected period"
                  tone="emerald"
                  icon={<TrendingUp size={18} />}
                />
                <ExecutiveMetricCard
                  title="Forecast variance"
                  value={formatMoney((analytics.summary.annualized_revenue_ex_vat ?? 0) - budgetSummary.annualRevenueTarget)}
                  subtitle="Run-rate versus the annual revenue target"
                  tone="rose"
                  icon={<Flame size={18} />}
                />
              </div>
            ) : (
              <div className="max-w-2xl space-y-3">
                <EmptyState
                  title="No budget plan configured in this browser"
                  body="Budget / Forecast comparisons appear once a plan is saved on the Budget / Forecast page for the same company and year."
                />
                <Link
                  href={`/companies/${companyId}/budget-forecast`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  Open Budget / Forecast
                </Link>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Operational Performance"
            subtitle="See how sales and labour move together, and where the weakest days and weeks sit."
            className={activeSection !== "operations" ? "hidden" : ""}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex items-center gap-3">
                  <LineChartIcon size={18} className="text-zinc-500" />
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Sales vs labour relationship</h3>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Each point is a weekly report. The goal is higher revenue with a controlled labour share.
                </p>
                <div className="mt-5 h-[220px]">
                  {analytics.weekly_trend.length > 0 && labourChartReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis
                          type="number"
                          dataKey="revenue_ex_vat"
                          name="Revenue"
                          tick={{ fill: "#71717a", fontSize: 12 }}
                          tickFormatter={(value) => formatMoney(value as number)}
                        />
                        <YAxis
                          type="number"
                          dataKey="labour_pct"
                          name="Labour %"
                          tick={{ fill: "#71717a", fontSize: 12 }}
                          tickFormatter={(value) => formatPct(value as number)}
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          formatter={(value: number | string | undefined, name) => {
                            const key = String(name ?? "").toLowerCase()
                            if (key.includes("revenue")) return formatMoney(Number(value ?? 0))
                            return formatPct(Number(value ?? 0))
                          }}
                          contentStyle={{
                            borderRadius: 16,
                            border: "1px solid #e4e4e7",
                            background: "#ffffff",
                          }}
                        />
                        <Scatter
                          name="Weekly points"
                          data={analytics.weekly_trend.map((point) => ({
                            revenue_ex_vat: point.revenue_ex_vat,
                            labour_pct: point.labour_pct ?? 0,
                            label: point.label,
                          }))}
                          fill="#0f172a"
                        >
                          {analytics.weekly_trend.map((entry, index) => (
                            <Cell key={`cell-${entry.label}-${index}`} fill={entry.labour_pct && entry.labour_pct > 0.35 ? "#e11d48" : "#0f172a"} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="Labour data is too thin for a useful chart"
                      body="Weekly reports exist, but labour coverage is not strong enough yet to make the scatter plot meaningful."
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Flame size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Weakest operating weeks</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {weakWeeks.length > 0 ? (
                      weakWeeks.map((point) => (
                        <div key={point.period} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-950">{point.label}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                            Revenue {formatMoney(point.revenue_ex_vat)} - Labour {formatPct(point.labour_pct)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-zinc-700">{formatMoney(point.net_profit)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No weak weeks to rank"
                        body="The weekly trend needs at least one report before the weakest weeks can be surfaced."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Compass size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Weakest days</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {weakestDays.length > 0 ? (
                      weakestDays.map((item) => (
                        <div key={`${item.key}-${item.start_date}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                          <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">{formatMoney(item.revenue_ex_vat)} revenue ex VAT</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No weak day ranking yet"
                        body="Day-level revenue rankings appear once invoice dates are available in the selected period."
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-zinc-500" />
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Coverage</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Weekly reports</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.weekly_reports)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Matched products</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.matched_products)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Sales invoices</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.sales_invoices)}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Purchase lines</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCount(analytics.coverage.purchase_lines)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

