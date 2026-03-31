"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getCompanyById, getDashboard, type Company, type DashboardData } from "@/services/api"
import { ArrowLeft, BarChart3, TrendingUp, Wallet, Target, Percent } from "lucide-react"

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

export default function CompanyAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [company, setCompany] = useState<Company | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
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
        const message = err instanceof Error ? err.message : "Failed to load analytics."

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

    loadAnalytics()
  }, [companyId, router])

  const chartData = useMemo(() => {
    if (!dashboard) return []

    return dashboard.last_weeks.map((week) => ({
      week: week.week_ending,
      sales: week.sales_ex_vat,
      grossProfit: week.gross_profit,
      netProfit: week.net_profit,
      grossMargin: week.gross_margin_pct,
      netMargin: week.net_margin_pct,
    }))
  }, [dashboard])

  const labourPct = useMemo(() => {
    if (!dashboard || dashboard.total_sales_ex_vat <= 0) return 0
    return dashboard.total_wages / dashboard.total_sales_ex_vat
  }, [dashboard])

  const foodCostPct = useMemo(() => {
    if (!dashboard || dashboard.total_sales_ex_vat <= 0) return 0
    return dashboard.total_food_cost / dashboard.total_sales_ex_vat
  }, [dashboard])

  const avgNetMargin = dashboard?.avg_net_margin_pct ?? 0

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
            Analytics
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
            Trends, margin behaviour, and operating signals for {company?.name ?? "this company"}.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Company scope
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{company?.name ?? "Loading..."}</p>
          <p className="mt-1 text-sm text-zinc-500">All analytics are scoped to this company.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-zinc-500">Loading analytics...</p>
        </div>
      )}

      {!loading && dashboard && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              title="Revenue"
              value={fmtMoney(dashboard.total_sales_ex_vat)}
              subtitle="Sales ex VAT over the last 4 weeks"
            />
            <MetricCard
              title="Gross Profit"
              value={fmtMoney(dashboard.total_gross_profit)}
              subtitle="Weekly gross profit converted into a 4 week view"
            />
            <MetricCard
              title="Net Profit"
              value={fmtMoney(dashboard.total_net_profit)}
              subtitle="Bottom-line result across the latest period"
            />
            <MetricCard
              title="Net Margin"
              value={fmtPct(avgNetMargin)}
              subtitle="Average net margin across the selected period"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <BarChart3 size={18} className="text-zinc-500" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Trend</h3>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                Revenue, gross profit, and net profit over the latest weekly window.
              </p>
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={fmtMoney} />
                    <Tooltip
                      formatter={(value: number | string | undefined) => fmtMoney(Number(value ?? 0))}
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid #e4e4e7",
                        background: "#ffffff",
                      }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#0f172a" fill="url(#analyticsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Percent size={18} className="text-zinc-500" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Margin profile</h3>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Gross margin</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">
                    {fmtPct(dashboard.avg_gross_margin_pct)}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Net margin</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtPct(avgNetMargin)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Labour %</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtPct(labourPct)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-500">Food cost %</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{fmtPct(foodCostPct)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Target size={18} className="text-zinc-500" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Focus</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-500">
                This page is now structured so Budget / Forecast can feed targets, pacing, and
                variance messaging later without changing the route model again.
              </p>
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800">Why it matters</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Analytics, home insights, and future forecast alerts should all point back to the
                  same company-level target model.
                </p>
              </div>
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-500">Recommended next check</p>
                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  Compare margin pressure over the last few weeks and then review the Budget /
                  Forecast page to set a target pace for this company.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
