"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  getCompanies,
  getWeeklyReports,
  getWeeklyReportsSummary,
  syncZohoSales,
  type Company,
  type WeeklyReportListItem,
  type WeeklyReportsSummary,
} from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  TrendingUp,
  Trash2,
  Wallet,
  X,
} from "lucide-react"

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
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
  }).format(d)
}

function buildWeekMainLabel(report: WeeklyReportListItem) {
  if (report.week_start && report.week_end) {
    return `${formatShortDate(report.week_start)} → ${formatDate(report.week_end)}`
  }
  return formatDate(report.week_ending)
}

function buildWeekSubLabel(report: WeeklyReportListItem) {
  if (report.iso_week && report.iso_year) {
    return `Week ${report.iso_week} • ${report.iso_year}`
  }
  return "Weekly report"
}

function getSourceBadge(source?: string | null) {
  const value = (source || "manual").toLowerCase()

  if (value.includes("zoho")) {
    return {
      label: "Zoho",
      className: "border border-sky-200 bg-sky-50 text-sky-700",
    }
  }

  if (value.includes("square")) {
    return {
      label: "Square",
      className: "border border-violet-200 bg-violet-50 text-violet-700",
    }
  }

  return {
    label: "Manual",
    className: "border border-zinc-200 bg-zinc-50 text-zinc-700",
  }
}

function computeNetProfit(report: WeeklyReportListItem) {
  if (typeof report.net_profit === "number") return report.net_profit

  return (
    (report.sales_ex_vat || 0) -
    ((report.wages || 0) + (report.holiday_pay || 0)) -
    (report.food_cost || 0) -
    (report.fixed_costs || 0) -
    (report.variable_costs || 0) -
    (report.loans_hp || 0) -
    (report.vat_due || 0)
  )
}

function computeNetMargin(report: WeeklyReportListItem) {
  if (typeof report.net_margin_pct === "number") return report.net_margin_pct

  const netProfit = computeNetProfit(report)
  return report.sales_ex_vat > 0 ? netProfit / report.sales_ex_vat : 0
}

function getMarginBadgeClass(netMargin: number) {
  if (netMargin >= 0.15) return "bg-emerald-100 text-emerald-700"
  if (netMargin >= 0.1) return "bg-amber-100 text-amber-700"
  return "bg-rose-100 text-rose-700"
}

export default function CompanyWeeklyReportsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [companies, setCompanies] = useState<Company[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [reports, setReports] = useState<WeeklyReportListItem[]>([])
  const [summary, setSummary] = useState<WeeklyReportsSummary | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [syncingZoho, setSyncingZoho] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const companiesData = await getCompanies()
      setCompanies(companiesData)

      const companyData = companiesData.find((c) => c.id === companyId)
      if (!companyData) {
        setError("Company not found.")
        return
      }

      setCompany(companyData)

      const [reportsData, summaryData] = await Promise.all([
        getWeeklyReports(companyId),
        getWeeklyReportsSummary(companyId),
      ])

      setReports(reportsData)
      setSummary(summaryData)
      setSelectedIds({})
    } catch (err) {
      console.error("Weekly reports page error:", err)
      setError(err instanceof Error ? err.message : "Failed to load weekly reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [companyId])

  async function handleZohoSync() {
    try {
      setSyncingZoho(true)
      setSyncError(null)
      setSyncMessage(null)

      const result = await syncZohoSales(companyId, 180)

      setSyncMessage(
        `Zoho sync complete. ${result.created_reports} reports created, ${result.skipped_existing_reports} existing weeks skipped.`
      )

      await loadData()
    } catch (err) {
      console.error("Zoho sync error:", err)
      setSyncError(err instanceof Error ? err.message : "Failed to sync Zoho sales.")
    } finally {
      setSyncingZoho(false)
    }
  }

  const uiSummary = useMemo(() => {
    if (summary) return summary

    const totalReports = reports.length
    const importedReports = reports.filter((r) =>
      (r.source || "").toLowerCase().includes("zoho")
    ).length
    const manualReports = totalReports - importedReports
    const totalSalesIncVat = reports.reduce((sum, report) => sum + (report.sales_inc_vat || 0), 0)
    const totalSalesExVat = reports.reduce((sum, report) => sum + (report.sales_ex_vat || 0), 0)
    const totalWages = reports.reduce(
      (sum, report) => sum + (report.wages || 0) + (report.holiday_pay || 0),
      0
    )
    const totalNetProfit = reports.reduce((sum, report) => sum + computeNetProfit(report), 0)

    return {
      total_reports: totalReports,
      imported_reports: importedReports,
      manual_reports: manualReports,
      total_sales_inc_vat: totalSalesIncVat,
      total_sales_ex_vat: totalSalesExVat,
      total_wages: totalWages,
      total_net_profit: totalNetProfit,
    }
  }, [summary, reports])

  const selectedReportIds = useMemo(() => {
    return reports.filter((r) => selectedIds[r.id]).map((r) => r.id)
  }, [reports, selectedIds])

  const selectedCount = selectedReportIds.length

  const allVisibleSelected = useMemo(() => {
    return reports.length > 0 && reports.every((r) => selectedIds[r.id])
  }, [reports, selectedIds])

  const someSelected = useMemo(() => {
    return reports.some((r) => selectedIds[r.id])
  }, [reports, selectedIds])

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds({})
      return
    }

    const next: Record<string, boolean> = {}
    reports.forEach((report) => {
      next[report.id] = true
    })
    setSelectedIds(next)
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  async function handleDeleteSelected() {
    try {
      setDeleteBusy(true)
      setDeleteError(null)

      // UX pronta. Delete real depende de backend/API endpoint.
      throw new Error(
        "Delete action UI is ready, but the backend delete endpoint for weekly reports is not connected yet."
      )
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete selected reports."
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(244,244,245,1)_38%,_rgba(235,235,240,1)_100%)] text-zinc-950">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[300px_1fr]">
        <aside className="flex min-h-screen flex-col border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(242,242,245,0.9))] px-5 py-7 backdrop-blur">
          <div className="rounded-[32px] border border-white/80 bg-white/70 p-5 shadow-sm">
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

              
            </div>

            <Link
              href={`/companies/${companyId}/reports`}
              className="block rounded-2xl bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm ring-1 ring-zinc-200"
            >
              <div className="flex items-center gap-3">
                <FileText size={16} />
                Weekly Reports
              </div>
            </Link>

            <Link
              href={`/companies/${companyId}/analytics`}
              className="block rounded-2xl px-4 py-3 text-sm text-zinc-500 transition hover:bg-white/70"
            >
              <div className="flex items-center gap-3">
                <CalendarDays size={16} />
                Analytics
              </div>
            </Link>
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Sparkles size={14} />
              Weekly Intelligence
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Review weekly margin performance, select reports in bulk, and manage historical reporting with a cleaner premium workflow.
            </p>
          </div>

          <div className="mt-auto pt-8">
            <Link
              href={`/companies/${companyId}/settings`}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white"
            >
              <Settings size={16} />
              Settings
            </Link>
          </div>
        </aside>

        <section className="px-6 py-7 md:px-8 xl:px-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4">
                <Link
                  href={`/companies/${companyId}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to Company
                </Link>
              </div>

              <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                {company?.name ?? "Selected Company"}
              </h2>
              <p className="mt-3 max-w-3xl text-base text-zinc-600">
                Weekly financial reports, historical performance, and detailed report workspace for this company.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start">
              {company?.sales_source === "zoho" && (
                <button
                  onClick={handleZohoSync}
                  disabled={syncingZoho}
                  className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={16} className={syncingZoho ? "animate-spin" : ""} />
                  {syncingZoho ? "Syncing..." : "Sync Zoho Sales"}
                </button>
              )}

              <Link
                href={`/companies/${companyId}/new`}
                className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                <Plus size={16} />
                Add Weekly Report
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {syncError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {syncError}
            </div>
          )}

          {syncMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
              {syncMessage}
            </div>
          )}

          {loading ? (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading weekly reports...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
                    <FileText size={18} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-zinc-500">Total Reports</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {uiSummary.total_reports}
                  </p>
                </div>

                <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                    <RefreshCw size={18} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-zinc-500">Imported</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {uiSummary.imported_reports}
                  </p>
                </div>

                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Wallet size={18} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-zinc-500">Sales ex VAT</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {fmtMoney(uiSummary.total_sales_ex_vat)}
                  </p>
                </div>

                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <TrendingUp size={18} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-zinc-500">Net Profit</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                    {fmtMoney(uiSummary.total_net_profit)}
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-[30px] border border-zinc-200 bg-white/95 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-zinc-100 px-7 py-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                      Report History
                    </h3>
                    <p className="mt-1.5 text-sm text-zinc-500">
                      Select individual weeks, manage reports in bulk, or open any report to edit details.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Latest weeks first
                  </div>
                </div>

                {(someSelected || deleteError) && (
                  <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/70 px-7 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-zinc-700">
                      {selectedCount} {selectedCount === 1 ? "week selected" : "weeks selected"}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedIds({})}
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <X size={15} />
                        Clear selection
                      </button>

                      <button
                        onClick={() => {
                          setDeleteError(null)
                          setShowDeleteModal(true)
                        }}
                        disabled={selectedCount === 0}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={15} />
                        Delete selected
                      </button>
                    </div>
                  </div>
                )}

                {deleteError && (
                  <div className="mx-7 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {deleteError}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-500">
                      <tr>
                        <th className="w-[56px] px-6 py-4 font-medium">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                            aria-label="Select all weeks"
                          />
                        </th>
                        <th className="px-6 py-4 font-medium">Week</th>
                        <th className="px-6 py-4 font-medium">Week Ending</th>
                        <th className="px-6 py-4 font-medium">Source</th>
                        <th className="px-6 py-4 font-medium">Sales ex VAT</th>
                        <th className="px-6 py-4 font-medium">Labour</th>
                        <th className="px-6 py-4 font-medium">Net Profit</th>
                        <th className="px-6 py-4 font-medium">Net Margin</th>
                        <th className="px-6 py-4 font-medium text-right">Open</th>
                      </tr>
                    </thead>

                    <tbody>
                      {reports.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center text-zinc-500">
                            No weekly reports yet. Create the first report or sync from Zoho.
                          </td>
                        </tr>
                      ) : (
                        reports.map((report) => {
                          const source = getSourceBadge(report.source)
                          const netProfit = computeNetProfit(report)
                          const netMargin = computeNetMargin(report)
                          const labourTotal = (report.wages || 0) + (report.holiday_pay || 0)
                          const isSelected = !!selectedIds[report.id]

                          return (
                            <tr
                              key={report.id}
                              className={`group border-t border-zinc-100 transition hover:bg-zinc-50/80 ${
                                isSelected ? "bg-zinc-50/80" : ""
                              }`}
                            >
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRow(report.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                                  aria-label={`Select week ${report.id}`}
                                />
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                <div className="font-medium text-zinc-950">
                                  {buildWeekMainLabel(report)}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">
                                  {buildWeekSubLabel(report)}
                                </div>
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-zinc-600"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {formatDate(report.week_ending)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${source.className}`}
                                >
                                  {source.label}
                                </span>
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 font-medium text-zinc-900"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(report.sales_ex_vat)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-zinc-700"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(labourTotal)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-zinc-700"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(netProfit)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMarginBadgeClass(
                                    netMargin
                                  )}`}
                                >
                                  {fmtPct(netMargin)}
                                </span>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() =>
                                    router.push(`/companies/${companyId}/reports/${report.id}`)
                                  }
                                  className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-zinc-900"
                                >
                                  View
                                  <ChevronRight size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                <Trash2 size={18} />
              </div>

              <div className="flex-1">
                <h4 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Delete selected weeks?
                </h4>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  You selected {selectedCount} {selectedCount === 1 ? "weekly report" : "weekly reports"}.
                  This action should permanently remove them.
                </p>
                <p className="mt-3 text-sm text-zinc-500">
                  The UI is ready. The real delete action still needs the backend endpoint connected.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteError(null)
                }}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await handleDeleteSelected()
                  setShowDeleteModal(false)
                }}
                disabled={deleteBusy}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={15} />
                {deleteBusy ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}