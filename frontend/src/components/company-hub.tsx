"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Building2,
  Lightbulb,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react"
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

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-sm">
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
            <p className="text-lg font-semibold tracking-tight text-zinc-950">{company.name}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {company.sales_source ? `Sales source: ${company.sales_source}` : "Company workspace"}
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
    </Link>
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
        setError(err instanceof Error ? err.message : "Failed to load company hub.")
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

  const focusLine = useMemo(() => {
    if (!portfolio) return "Add your companies to begin building a portfolio view."
    if (portfolio.total_net_profit <= 0) {
      return "The portfolio is revenue active but still needs stronger profit conversion."
    }
    return "The portfolio is generating profit. Open each company workspace to tighten margin drivers."
  }, [portfolio])

  return (
    <WorkspaceShell mode="tenant">
      <div className="space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Company Hub
            </p>
            <h2 className="mt-3 text-5xl font-semibold tracking-tight text-zinc-950">
              Select a company workspace
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-500">
              Choose a company to enter its dedicated financial workspace.
            </p>
          </div>

          <Link
            href="/companies/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <Plus size={16} />
            Add Company
          </Link>
        </div>

        {error && (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-zinc-500">Loading companies...</p>
          </div>
        )}

        {!loading && portfolio && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              <StatCard
                title="Portfolio revenue"
                value={fmtMoney(portfolio.total_sales_ex_vat)}
                subtitle="Combined sales ex VAT across the tenant"
              />
              <StatCard
                title="Portfolio gross profit"
                value={fmtMoney(portfolio.total_gross_profit)}
                subtitle="Gross profit across all companies"
              />
              <StatCard
                title="Portfolio net profit"
                value={fmtMoney(portfolio.total_net_profit)}
                subtitle="Net profit across all companies"
              />
              <StatCard
                title="Active companies"
                value={String(portfolio.companies.length)}
                subtitle="Companies available in this tenant"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">
                      Portfolio focus
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                      {focusLine}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">
                      Next step
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                      Review each company workspace in sequence
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-950">
                    Companies
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Open a company workspace to see operational overview, reports, analytics and planning.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {rankedCompanies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    dashboard={dashboards[company.id]}
                  />
                ))}

                <Link
                  href="/companies/new"
                  className="group flex min-h-[220px] items-center justify-center rounded-[30px] border border-dashed border-zinc-300 bg-white/70 p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-white"
                >
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                      <Plus size={20} />
                    </div>
                    <p className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">
                      Add Company
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Create another company inside this tenant.
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {portfolio.companies.length > 0 && (
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <TrendingUp size={18} className="text-zinc-500" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                    Portfolio summary
                  </h3>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Company</th>
                        <th className="px-5 py-3 font-medium">Sales ex VAT</th>
                        <th className="px-5 py-3 font-medium">Net Profit</th>
                        <th className="px-5 py-3 font-medium">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.companies.map((company) => (
                        <tr key={company.company_id} className="border-t border-zinc-100">
                          <td className="px-5 py-4 font-medium text-zinc-900">
                            <Link href={`/companies/${company.company_id}`} className="hover:underline">
                              {company.company_name}
                            </Link>
                          </td>
                          <td className="px-5 py-4">{fmtMoney(company.sales_ex_vat)}</td>
                          <td className="px-5 py-4">{fmtMoney(company.net_profit)}</td>
                          <td className="px-5 py-4">{fmtPct(company.net_margin_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
