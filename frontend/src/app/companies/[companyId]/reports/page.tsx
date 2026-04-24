"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  deleteWeeklyReportsBulk,
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
import WorkspacePageHeader from "@/components/workspace-page-header"
import {
  formatDateLong,
  getCurrentWeekEndingSundayInputValue,
  getWeekInfo,
} from "@/lib/report-utils"

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
  return value ? formatDateLong(value) : "-"
}

function buildWeekMainLabel(report: WeeklyReportListItem) {
  if (report.week_start && report.week_end) {
    return `${formatDateLong(report.week_start)} \u2192 ${formatDateLong(report.week_end)}`
  }
  return formatDate(report.week_ending)
}

function buildWeekSubLabel(report: WeeklyReportListItem) {
  const { isoWeek, isoYear } = getWeekInfo(report.week_ending)
  return `Week ${isoWeek} \u00B7 ${isoYear}`
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

function getTodayLocalISO() {
  return getCurrentWeekEndingSundayInputValue()
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
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncPreset, setSyncPreset] = useState<
    "this_week" | "last_week" | "last_4_weeks" | "last_12_weeks" | "specific_week"
  >("last_4_weeks")
  const [specificWeekEnding, setSpecificWeekEnding] = useState(getTodayLocalISO())

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

      const options =
        syncPreset === "specific_week"
          ? {
              preset: syncPreset,
              weekEnding: specificWeekEnding,
            }
          : {
              preset: syncPreset,
            }

      const result = await syncZohoSales(companyId, options)

      if (result.preset === "specific_week" && result.week_ending) {
        setSyncMessage(
          `Zoho sync complete for week ending ${result.week_ending}. ${result.created_reports} reports created, ${result.updated_reports ?? 0} updated, ${result.skipped_existing_reports} skipped.`
        )
      } else {
        setSyncMessage(
          `Zoho sync complete for ${result.preset || "selected range"}. ${result.created_reports} reports created, ${result.updated_reports ?? 0} updated, ${result.skipped_existing_reports} skipped.`
        )
      }

      setShowSyncModal(false)
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

      if (selectedReportIds.length === 0) {
        throw new Error("No weekly reports selected.")
      }

      await deleteWeeklyReportsBulk(selectedReportIds)

      setShowDeleteModal(false)
      setSelectedIds({})
      await loadData()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete selected reports."
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <div className="space-y-8">
        <WorkspacePageHeader
          label="Weekly reporting"
          title="Weekly Reports"
          subtitle={`Weekly financial reports, historical performance, and detailed report workspace for ${company?.name ?? "this company"}.`}
          companyName={company?.name ?? "Selected Company"}
          companyMeta={
            uiSummary.total_reports > 0
              ? `${uiSummary.total_reports} weekly reports`
              : "No weekly reports yet. Import or create the first report to unlock the portfolio view."
          }
          companyBadge={
            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {company?.sales_source === "zoho" ? "Zoho source" : "Manual input"}
            </span>
          }
          actions={
            <>
              {company?.sales_source === "zoho" && (
                <button
                  onClick={() => {
                    setSyncError(null)
                    setSyncMessage(null)
                    setShowSyncModal(true)
                  }}
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
            </>
          }
        />

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
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="text-zinc-500">Loading weekly reports...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-transform duration-150 hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
                    <FileText size={18} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Total Reports</p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 md:text-[2rem]">
                    {uiSummary.total_reports}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-transform duration-150 hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                    <Wallet size={18} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Sales ex VAT</p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 md:text-[2rem]">
                    {fmtMoney(uiSummary.total_sales_ex_vat)}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-transform duration-150 hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <TrendingUp size={18} />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Net Profit</p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950 md:text-[2rem]">
                    {fmtMoney(uiSummary.total_net_profit)}
                  </p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950 md:text-[1.55rem]">
                      Report History
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Select individual weeks, manage reports in bulk, or open any report to edit details.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Latest weeks first
                  </div>
                </div>

                {(someSelected || deleteError) && (
                  <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
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
                  <div className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                        <th className="px-6 py-4 font-medium">Sales inc VAT</th>
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
                          const netProfit = computeNetProfit(report)
                          const netMargin = computeNetMargin(report)
                          const labourTotal = (report.wages || 0) + (report.holiday_pay || 0)
                          const isSelected = !!selectedIds[report.id]

                          return (
                            <tr
                              key={report.id}
                            className={`group border-t border-zinc-100/80 transition hover:bg-zinc-50/70 ${
                                isSelected ? "bg-zinc-50/80" : ""
                              }`}
                            >
                              <td className="px-4 py-3">
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
                                className="cursor-pointer px-6 py-4 font-medium text-zinc-900"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                <div className="text-zinc-950">
                                  {buildWeekMainLabel(report)}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
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
                                className="cursor-pointer px-6 py-4 text-right font-medium text-zinc-900"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(report.sales_inc_vat || 0)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-right font-medium text-zinc-900"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(report.sales_ex_vat)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-right text-zinc-700"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(labourTotal)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-right text-zinc-700"
                                onClick={() =>
                                  router.push(`/companies/${companyId}/reports/${report.id}`)
                                }
                              >
                                {fmtMoney(netProfit)}
                              </td>

                              <td
                                className="cursor-pointer px-6 py-4 text-right"
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

                              <td className="px-4 py-3 text-right">
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
      </div>

      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Sync Zoho Sales
                </h4>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Choose the week range to sync. Smaller ranges reduce API usage and avoid unnecessary sync load.
                </p>
              </div>

              <button
                onClick={() => setShowSyncModal(false)}
                disabled={syncingZoho}
                className="rounded-2xl p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="syncPreset"
                  value="this_week"
                  checked={syncPreset === "this_week"}
                  onChange={() => setSyncPreset("this_week")}
                />
                <span className="text-sm font-medium text-zinc-800">This week</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="syncPreset"
                  value="last_week"
                  checked={syncPreset === "last_week"}
                  onChange={() => setSyncPreset("last_week")}
                />
                <span className="text-sm font-medium text-zinc-800">Last week</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="syncPreset"
                  value="last_4_weeks"
                  checked={syncPreset === "last_4_weeks"}
                  onChange={() => setSyncPreset("last_4_weeks")}
                />
                <span className="text-sm font-medium text-zinc-800">Last 4 weeks</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="syncPreset"
                  value="last_12_weeks"
                  checked={syncPreset === "last_12_weeks"}
                  onChange={() => setSyncPreset("last_12_weeks")}
                />
                <span className="text-sm font-medium text-zinc-800">Last 12 weeks</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="syncPreset"
                  value="specific_week"
                  checked={syncPreset === "specific_week"}
                  onChange={() => setSyncPreset("specific_week")}
                />
                <span className="text-sm font-medium text-zinc-800">Specific week</span>
              </label>

              {syncPreset === "specific_week" && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Week ending
                  </label>
                  <input
                    type="date"
                    value={specificWeekEnding}
                    onChange={(e) => setSpecificWeekEnding(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-0 transition focus:border-zinc-400"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                disabled={syncingZoho}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={handleZohoSync}
                disabled={syncingZoho || (syncPreset === "specific_week" && !specificWeekEnding)}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={15} className={syncingZoho ? "animate-spin" : ""} />
                {syncingZoho ? "Syncing..." : "Run sync"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  This action will permanently remove the selected weekly reports.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteBusy}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteSelected}
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
    </>
  )
}

