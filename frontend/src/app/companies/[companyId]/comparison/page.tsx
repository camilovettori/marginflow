"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ArrowRightLeft, Building2, TrendingUp } from "lucide-react"
import { getCompanies, getDashboard, type Company, type DashboardData } from "@/services/api"

type DashboardMap = Record<string, DashboardData>

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

export default function CompanyComparisonPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [companies, setCompanies] = useState<Company[]>([])
  const [dashboards, setDashboards] = useState<DashboardMap>({})
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
            const dashboard = await getDashboard(company.id)
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

  const rankedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      const aRevenue = dashboards[a.id]?.total_sales_ex_vat ?? 0
      const bRevenue = dashboards[b.id]?.total_sales_ex_vat ?? 0
      return bRevenue - aRevenue
    })
  }, [companies, dashboards])

  const selectedRank = useMemo(() => {
    const index = rankedCompanies.findIndex((company) => company.id === companyId)
    return index >= 0 ? index + 1 : null
  }, [rankedCompanies, companyId])

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
            Company Comparison
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
            Compare this company against the rest of the tenant portfolio using the same weekly
            margin window.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Selected company
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{selectedCompany?.name ?? "Company"}</p>
          <p className="mt-1 text-sm text-zinc-500">
            Rank {selectedRank ?? "—"} out of {companies.length || "—"}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-zinc-500">Loading company comparison...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Company</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {selectedCompany?.name ?? "Company"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">Selected workspace in this portfolio</p>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Revenue rank</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {selectedRank ?? "—"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">Based on sales ex VAT</p>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Selected revenue</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {dashboards[companyId] ? fmtMoney(dashboards[companyId].total_sales_ex_vat) : "—"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">Sales ex VAT over latest window</p>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Selected net margin</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
                {dashboards[companyId] ? fmtPct(dashboards[companyId].avg_net_margin_pct) : "—"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">Latest 4-week margin profile</p>
            </div>
          </div>

          <div className="rounded-[30px] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-7 py-6">
              <div className="flex items-center gap-3">
                <ArrowRightLeft size={18} className="text-zinc-500" />
                <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                  Portfolio comparison
                </h3>
              </div>
              <p className="mt-1.5 text-sm text-zinc-500">
                Compare revenue, profit, and margin across all companies in the tenant.
              </p>
            </div>

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
                  {rankedCompanies.map((company) => {
                    const dashboard = dashboards[company.id]
                    const isSelected = company.id === companyId

                    return (
                      <tr
                        key={company.id}
                        className={`border-t border-zinc-100 transition ${
                          isSelected ? "bg-zinc-50/80" : "hover:bg-zinc-50/50"
                        }`}
                      >
                        <td className="px-6 py-4 font-medium text-zinc-900">
                          <Link href={`/companies/${company.id}`} className="flex items-center gap-3 hover:underline">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                              <Building2 size={16} />
                            </div>
                            {company.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {dashboard ? fmtMoney(dashboard.total_sales_ex_vat) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {dashboard ? fmtMoney(dashboard.total_gross_profit) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {dashboard ? fmtMoney(dashboard.total_net_profit) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {dashboard ? fmtPct(dashboard.avg_gross_margin_pct) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {dashboard ? fmtPct(dashboard.avg_net_margin_pct) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-zinc-500" />
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                Executive note
              </h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-zinc-500">
              This comparison page is designed to stay company-scoped while still showing the
              broader tenant picture. That makes it a good place for future target-versus-actual and
              peer benchmarking without reworking the routes again.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
