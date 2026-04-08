"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  disconnectZohoConnection,
  getSalesAnalytics,
  getZohoConnectUrl,
  syncUnifyZohoSales,
  type SalesAnalyticsResponse,
  type SalesCustomerRow,
} from "@/services/api"
import WorkspacePageHeader from "@/components/workspace-page-header"
import {
  BarChart3,
  Building2,
  CalendarDays,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Target,
  Users,
  Wallet,
} from "lucide-react"

type SalesRange = "week" | "4w" | "3m" | "6m" | "12m"
type SalesMetric = "sales_inc_vat" | "sales_ex_vat" | "invoice_count"

const rangeOptions: Array<{ value: SalesRange; label: string; days: number }> = [
  { value: "week", label: "Week", days: 7 },
  { value: "4w", label: "4 Weeks", days: 28 },
  { value: "3m", label: "3 Months", days: 90 },
  { value: "6m", label: "6 Months", days: 180 },
  { value: "12m", label: "12 Months", days: 365 },
]

const metricOptions: Array<{ value: SalesMetric; label: string }> = [
  { value: "sales_inc_vat", label: "Sales inc VAT" },
  { value: "sales_ex_vat", label: "Sales ex VAT" },
  { value: "invoice_count", label: "Invoice Count" },
]

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function fmtInt(value: number) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(value ?? 0)
}

function fmtPct(value: number) {
  return `${((value ?? 0) * 100).toFixed(1)}%`
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

function formatShortDate(value?: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("en-IE", { day: "2-digit", month: "short" }).format(d)
}

function formatLocalISODate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function subtractDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  return d
}

function getRangeWindow(range: SalesRange) {
  const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[1]
  return {
    dateFrom: formatLocalISODate(subtractDays(option.days)),
    dateTo: formatLocalISODate(new Date()),
    label: option.label,
    days: option.days,
  }
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
  tone?: "default" | "green" | "blue" | "amber"
}) {
  const toneMap = {
    default: "border-zinc-200 bg-white",
    green: "border-emerald-200 bg-emerald-50/60",
    blue: "border-sky-200 bg-sky-50/60",
    amber: "border-amber-200 bg-amber-50/60",
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${toneMap[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 md:text-[2.35rem]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="border-b border-zinc-100 px-5 py-5 md:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 md:text-[1.9rem]">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function CustomerSummary({ customer }: { customer: SalesCustomerRow | null }) {
  if (!customer) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-500">
        No customer detail available yet. Sync Unify orders to unlock purchase breakdowns.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Selected customer
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
            {customer.customer_name}
          </h3>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Active
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Ex VAT
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-950">
            {fmtMoney(customer.total_spend_ex_vat)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Inc VAT
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-950">
            {fmtMoney(customer.total_spend_inc_vat)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Invoices
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-950">{fmtInt(customer.invoice_count)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Last purchase
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-950">
            {formatDate(customer.last_purchase_date)}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Ex VAT</th>
              <th className="px-4 py-3 font-medium text-right">Inc VAT</th>
            </tr>
          </thead>
          <tbody>
            {customer.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No line-item detail yet.
                </td>
              </tr>
            ) : (
              customer.items.map((item) => (
                <tr key={`${item.item_name}-${item.item_id ?? "item"}`} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-900">{item.item_name}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmtInt(item.quantity)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {fmtMoney(item.revenue_ex_vat)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {fmtMoney(item.revenue_inc_vat)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CompanySalesPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [analytics, setAnalytics] = useState<SalesAnalyticsResponse | null>(null)
  const [selectedRange, setSelectedRange] = useState<SalesRange>("4w")
  const [selectedMetric, setSelectedMetric] = useState<SalesMetric>("sales_inc_vat")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function loadSalesData() {
    try {
      setLoading(true)
      setError(null)
      const data = await getSalesAnalytics(companyId, selectedRange, selectedCustomerId)
      setAnalytics(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sales intelligence."
      if (
        message.toLowerCase().includes("session expired") ||
        message.toLowerCase().includes("401") ||
        message.toLowerCase().includes("missing bearer token") ||
        message.toLowerCase().includes("invalid token")
      ) {
        router.replace("/login")
        return
      }
      if (message.includes("API error 404")) {
        setError(
          "Sales intelligence is not available on the current backend build yet. Restart or redeploy the API so the new /api/sales route is loaded."
        )
        return
      }

      if (message.includes("API error 500")) {
        setError(
          "Sales intelligence is installed, but the backend returned an error. Check the API logs, Zoho sync tables, and recent migrations."
        )
        return
      }

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSalesData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedRange, selectedCustomerId])

  const selectedRangeWindow = useMemo(() => getRangeWindow(selectedRange), [selectedRange])
  const chartMetricLabel =
    metricOptions.find((item) => item.value === selectedMetric)?.label ?? "Sales inc VAT"
  const selectedCustomer = analytics?.customer_breakdown ?? analytics?.top_customers[0] ?? null
  const topCustomer = analytics?.top_customers[0] ?? null
  const topItem = analytics?.top_items[0] ?? null
  const chartData = useMemo(() => {
    if (!analytics) return []
    return analytics.invoice_trend.map((point) => ({
      period: formatShortDate(point.period),
      salesIncVat: point.sales_inc_vat,
      salesExVat: point.sales_ex_vat,
      invoiceCount: point.invoice_count,
    }))
  }, [analytics])
  const selectedCustomerKey =
    selectedCustomerId || selectedCustomer?.customer_id || selectedCustomer?.customer_name || null
  const totalTrendValue = useMemo(() => {
    if (!analytics) return 0
    return analytics.invoice_trend.reduce((sum, point) => {
      if (selectedMetric === "sales_ex_vat") return sum + point.sales_ex_vat
      if (selectedMetric === "invoice_count") return sum + point.invoice_count
      return sum + point.sales_inc_vat
    }, 0)
  }, [analytics, selectedMetric])
  const trendDirection = useMemo(() => {
    if (!analytics || analytics.invoice_trend.length < 2) return null
    const latest = analytics.invoice_trend[analytics.invoice_trend.length - 1]
    const previous = analytics.invoice_trend[analytics.invoice_trend.length - 2]
    const latestValue =
      selectedMetric === "sales_ex_vat"
        ? latest.sales_ex_vat
        : selectedMetric === "invoice_count"
          ? latest.invoice_count
          : latest.sales_inc_vat
    const previousValue =
      selectedMetric === "sales_ex_vat"
        ? previous.sales_ex_vat
        : selectedMetric === "invoice_count"
          ? previous.invoice_count
          : previous.sales_inc_vat
    if (previousValue === 0) return null
    return { delta: (latestValue - previousValue) / Math.abs(previousValue), latestValue, previousValue }
  }, [analytics, selectedMetric])

  async function handleSync() {
    try {
      if (!analytics?.connection.connected) return
      setSyncing(true)
      setSyncError(null)
      setSyncMessage(null)
      const result = await syncUnifyZohoSales(companyId)
      setSyncMessage(
        `Loaded ${result.products_loaded} products, fetched ${result.orders_fetched} Unify orders, created ${result.invoices_created} Zoho drafts, and skipped ${result.duplicates_skipped} duplicate groups.`
      )
      await loadSalesData()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync Unify orders.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Zoho Invoice for this company?")) return
    try {
      setDisconnecting(true)
      setSyncError(null)
      setSyncMessage(null)
      await disconnectZohoConnection(companyId)
      setSelectedCustomerId(null)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to disconnect Zoho.")
    } finally {
      setDisconnecting(false)
    }
  }

  function handleConnectZoho() {
    window.location.href = getZohoConnectUrl(companyId)
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        label="Sales intelligence"
        title="Sales"
        subtitle="Sales Intelligence for the selected company. Track Zoho invoices, top customers, item performance, and sales momentum in one place."
        companyName={analytics?.company_name ?? "Selected Company"}
        companyMeta={
          analytics
            ? `${fmtMoney(analytics.total_sales_ex_vat)} ex VAT across ${fmtInt(analytics.invoice_count)} invoices`
            : "Zoho-connected sales intelligence and invoice-level analysis."
        }
        companyBadge={
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {selectedRangeWindow.label} window
          </span>
        }
      />

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}
      {syncError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{syncError}</div>}
      {syncMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{syncMessage}</div>}
      {loading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-zinc-500">Loading sales intelligence...</p>
        </div>
      )}

      {!loading && analytics && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Sales inc VAT" value={fmtMoney(analytics.total_sales_inc_vat)} subtitle={`Latest ${selectedRangeWindow.label.toLowerCase()} of Zoho invoice activity.`} tone="amber" />
            <MetricCard title="Sales ex VAT" value={fmtMoney(analytics.total_sales_ex_vat)} subtitle="Corrected net revenue for reporting and weekly analytics." tone="green" />
            <MetricCard title="Invoice Count" value={fmtInt(analytics.invoice_count)} subtitle="Invoices captured in the selected time window." tone="blue" />
            <MetricCard title="Active Customers" value={fmtInt(analytics.active_customers)} subtitle="Distinct customers buying in this period." />
            <MetricCard title="Average Order Value" value={fmtMoney(analytics.average_order_value)} subtitle="Average basket value ex VAT." />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-zinc-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Zoho connection</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">
                    {analytics.connection.connected ? "Connected and ready" : "Not connected yet"}
                  </h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {analytics.connection.connected
                  ? "Sales sync uses the same Zoho ledger as Weekly Reports, so ex VAT reporting stays aligned across the workspace."
                  : "Connect Zoho Invoice to unlock invoice-level sales analytics, customer rankings, and weekly sales sync."}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Connected email</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">{analytics.connection.connected_email || "Not available"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Last sync</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">{formatDate(analytics.connection.last_sync_at)}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {analytics.connection.connected ? (
                  <>
                    <button onClick={handleSync} disabled={syncing || disconnecting} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                      <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                      {syncing ? "Syncing..." : "Sync Unify orders"}
                    </button>
                    <button onClick={handleDisconnect} disabled={disconnecting || syncing} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60">
                      <RotateCcw size={16} className={disconnecting ? "animate-spin" : ""} />
                      {disconnecting ? "Disconnecting..." : "Disconnect Zoho"}
                    </button>
                  </>
                ) : (
                  <button onClick={handleConnectZoho} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90">
                    <Shuffle size={16} />
                    Connect Zoho Invoice
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <CalendarDays size={18} className="text-zinc-500" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Time window</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Use the same window across the trend, customer ranking, items, and invoice list.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {rangeOptions.map((option) => {
                  const active = selectedRange === option.value
                  return (
                    <button key={option.value} onClick={() => setSelectedRange(option.value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white hover:text-zinc-950"}`}>
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <p className="text-sm font-medium text-zinc-500">Selected window total</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                  {chartMetricLabel === "Invoice Count" ? fmtInt(totalTrendValue) : fmtMoney(totalTrendValue)}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  This is the cumulative {chartMetricLabel.toLowerCase()} across the selected period.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <Target size={18} className="text-zinc-500" />
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Sales pulse</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <p className="text-sm font-medium text-zinc-500">Top customer</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-950">{topCustomer?.customer_name ?? "No customers yet"}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {topCustomer ? `${fmtMoney(topCustomer.total_spend_ex_vat)} ex VAT across ${fmtInt(topCustomer.invoice_count)} invoices` : "Sync Unify orders to reveal customer ranking and basket intelligence."}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <p className="text-sm font-medium text-zinc-500">Top item</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-950">{topItem?.item_name ?? "No items yet"}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {topItem ? `${fmtInt(topItem.quantity_sold)} sold for ${fmtMoney(topItem.revenue_ex_vat)} ex VAT` : "Item-level ranking will appear once invoice line items are synced."}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <p className="text-sm font-medium text-zinc-500">Momentum</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-950">
                    {trendDirection ? fmtPct(trendDirection.delta) : "No trend yet"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {trendDirection ? `${chartMetricLabel} moved from ${chartMetricLabel === "Invoice Count" ? fmtInt(trendDirection.previousValue) : fmtMoney(trendDirection.previousValue)} to ${chartMetricLabel === "Invoice Count" ? fmtInt(trendDirection.latestValue) : fmtMoney(trendDirection.latestValue)}` : "Need at least two periods to show movement."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card title="Sales trend" subtitle={`Weekly sales trend for ${analytics.company_name}.`}>
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {metricOptions.map((option) => {
                  const active = selectedMetric === option.value
                  return (
                    <button key={option.value} onClick={() => setSelectedMetric(option.value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white hover:text-zinc-950"}`}>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="p-6">
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="period" tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 12 }} tickFormatter={(value) => (selectedMetric === "invoice_count" ? fmtInt(Number(value)) : fmtMoney(Number(value)))} />
                    <Tooltip formatter={(value) => (selectedMetric === "invoice_count" ? fmtInt(Number(value ?? 0)) : fmtMoney(Number(value ?? 0)))} contentStyle={{ borderRadius: 16, border: "1px solid #e4e4e7", background: "#ffffff" }} />
                    <Area
                      type="monotone"
                      dataKey={selectedMetric === "sales_ex_vat" ? "salesExVat" : selectedMetric === "invoice_count" ? "invoiceCount" : "salesIncVat"}
                      stroke="#0f172a"
                      strokeWidth={3}
                      fill="url(#salesTrendFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                Showing {selectedRangeWindow.label.toLowerCase()} of Zoho invoice activity.{" "}
                {analytics.connection.connected ? "Sync pulls Unify orders into Zoho drafts and refreshes the sales ledger." : "Connect Zoho to turn this chart into live sales intelligence."}
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Top customers" subtitle="Customers ranked by spend in the selected time window.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Rank</th>
                      <th className="px-6 py-4 font-medium">Customer</th>
                      <th className="px-6 py-4 font-medium text-right">Spend ex VAT</th>
                      <th className="px-6 py-4 font-medium text-right">Invoices</th>
                      <th className="px-6 py-4 font-medium text-right">AOV</th>
                      <th className="px-6 py-4 font-medium text-right">Last purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                          No customer rankings yet. Sync Unify orders to populate customer analytics.
                        </td>
                      </tr>
                    ) : (
                      analytics.top_customers.map((customer) => {
                        const rowKey = customer.customer_id || customer.customer_name
                        const isSelected =
                          selectedCustomerKey === rowKey ||
                          analytics.customer_breakdown?.customer_id === customer.customer_id

                        return (
                          <tr
                            key={rowKey}
                            onClick={() => setSelectedCustomerId(customer.customer_id ?? null)}
                            className={`cursor-pointer border-t border-zinc-100/80 transition hover:bg-zinc-50/70 ${isSelected ? "bg-sky-50/50" : ""}`}
                          >
                            <td className="px-6 py-4 font-medium text-zinc-900">
                              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                                {customer.rank}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-zinc-950">{customer.customer_name}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                                {isSelected ? "Selected customer" : "Portfolio ranking"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-zinc-900">
                              {fmtMoney(customer.total_spend_ex_vat)}
                            </td>
                            <td className="px-6 py-4 text-right text-zinc-700">
                              {fmtInt(customer.invoice_count)}
                            </td>
                            <td className="px-6 py-4 text-right text-zinc-700">
                              {fmtMoney(customer.average_order_value)}
                            </td>
                            <td className="px-6 py-4 text-right text-zinc-700">
                              {formatDate(customer.last_purchase_date)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Customer purchase breakdown"
              subtitle="What the selected customer bought in the current window."
            >
              <div className="p-6">
                <CustomerSummary customer={selectedCustomer} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Top selling items" subtitle="Best-performing items by revenue and volume.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Rank</th>
                      <th className="px-6 py-4 font-medium">Item</th>
                      <th className="px-6 py-4 font-medium text-right">Qty sold</th>
                      <th className="px-6 py-4 font-medium text-right">Ex VAT</th>
                      <th className="px-6 py-4 font-medium text-right">Inc VAT</th>
                      <th className="px-6 py-4 font-medium text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                          No item rankings yet. Sync Unify orders to populate this view.
                        </td>
                      </tr>
                    ) : (
                      analytics.top_items.map((item) => (
                        <tr
                          key={`${item.item_name}-${item.rank}`}
                          className="border-t border-zinc-100/80 transition hover:bg-zinc-50/70"
                        >
                          <td className="px-6 py-4 font-medium text-zinc-900">{item.rank}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-950">{item.item_name}</div>
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtInt(item.quantity_sold)}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtMoney(item.revenue_ex_vat)}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtMoney(item.revenue_inc_vat)}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtInt(item.invoice_count)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Recent invoices"
              subtitle="Recent Zoho invoices captured in the selected range."
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Invoice</th>
                      <th className="px-6 py-4 font-medium">Customer</th>
                      <th className="px-6 py-4 font-medium text-right">Ex VAT</th>
                      <th className="px-6 py-4 font-medium text-right">Inc VAT</th>
                      <th className="px-6 py-4 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recent_invoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                          No invoice history in this range yet.
                        </td>
                      </tr>
                    ) : (
                      analytics.recent_invoices.map((invoice) => (
                        <tr
                          key={`${invoice.invoice_number ?? invoice.invoice_date}-${invoice.customer_name ?? "invoice"}`}
                          className="border-t border-zinc-100/80 transition hover:bg-zinc-50/70"
                        >
                          <td className="px-6 py-4 text-zinc-700">{formatDate(invoice.invoice_date)}</td>
                          <td className="px-6 py-4 font-medium text-zinc-950">
                            {invoice.invoice_number ?? "-"}
                          </td>
                          <td className="px-6 py-4 text-zinc-700">
                            {invoice.customer_name ?? "-"}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtMoney(invoice.total_ex_vat)}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700">
                            {fmtMoney(invoice.total_inc_vat)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                              {invoice.status ?? "Open"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-zinc-500" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Customer concentration</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {topCustomer
                  ? `Top customer contributes ${fmtPct(
                      analytics.total_sales_ex_vat > 0
                        ? topCustomer.total_spend_ex_vat / analytics.total_sales_ex_vat
                        : 0
                    )} of total spend in the selected period.`
                  : "No concentration signal yet. Sync invoices to reveal customer share."}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-zinc-500" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Weekly reports</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                The same synced sales ledger now feeds Weekly Reports, so sales ex VAT stays consistent across both modules.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-3">
                <BarChart3 size={18} className="text-zinc-500" />
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Trend quality</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {trendDirection
                  ? `Latest ${selectedMetric === "invoice_count" ? "activity" : chartMetricLabel.toLowerCase()} moved ${trendDirection.delta >= 0 ? "up" : "down"} by ${fmtPct(Math.abs(trendDirection.delta))} versus the previous point.`
                  : "Need a longer time series to calculate movement."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
