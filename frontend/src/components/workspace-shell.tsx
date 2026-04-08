"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  ArrowLeft,
  BarChart3,
  Building2,
  Home,
  Plus,
  Wallet,
  Settings2,
  FileText,
  TrendingUp,
  Target,
} from "lucide-react"
import {
  getCompanies,
  getMe,
  type Company,
  type MeResponse,
} from "@/services/api"

type WorkspaceMode = "tenant" | "company"

type WorkspaceShellProps = {
  mode: WorkspaceMode
  activeCompanyId?: string
  children: React.ReactNode
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
        active
          ? "border border-sky-200 bg-sky-50/80 text-zinc-950 shadow-sm"
          : "text-zinc-600 hover:bg-white/75 hover:text-zinc-950"
      }`}
    >
      <span className={active ? "text-sky-700" : "text-zinc-500"}>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

export default function WorkspaceShell({
  mode,
  activeCompanyId,
  children,
}: WorkspaceShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [companies, setCompanies] = useState<Company[]>([])
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        setLoading(true)
        setError(null)

        const [meData, companiesData] = await Promise.all([getMe(), getCompanies()])

        if (!meData?.tenant_id) {
          router.replace("/login")
          return
        }

        setMe(meData)
        setCompanies(companiesData)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load workspace."

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

    loadWorkspaceData()
  }, [router])

  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return null
    return companies.find((company) => company.id === activeCompanyId) ?? null
  }, [activeCompanyId, companies])

  const isCompanyRoute = mode === "company"
  const companyBaseHref = activeCompanyId ? `/companies/${activeCompanyId}` : "/"

  const companyNav = useMemo(
    () => [
      { href: companyBaseHref, label: "Home", icon: <Home size={16} /> },
      {
        href: `${companyBaseHref}/sales`,
        label: "Sales",
        icon: <Wallet size={16} />,
      },
      {
        href: `${companyBaseHref}/comparison`,
        label: "Company Comparison",
        icon: <ArrowLeftRight size={16} />,
      },
      {
        href: `${companyBaseHref}/reports`,
        label: "Weekly Reports",
        icon: <FileText size={16} />,
      },
      {
        href: `${companyBaseHref}/analytics`,
        label: "Analytics",
        icon: <TrendingUp size={16} />,
      },
      {
        href: `${companyBaseHref}/budget-forecast`,
        label: "Budget / Forecast",
        icon: <Target size={16} />,
      },
      {
        href: `${companyBaseHref}/settings`,
        label: "Settings",
        icon: <Settings2 size={16} />,
      },
    ],
    [companyBaseHref]
  )

  const activeCompanyNavHref = (href: string) => {
    if (!activeCompanyId) return false
    if (href === companyBaseHref) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(247,247,248,1)_42%,_rgba(241,243,245,1)_100%)] text-zinc-950">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[300px_1fr]">
        <aside className="flex min-h-screen flex-col border-r border-zinc-200/70 bg-zinc-50 px-5 py-7 backdrop-blur">
          <div className="rounded-[32px] border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-950">MarginFlow</h1>
                <p className="text-sm text-zinc-500">Margin intelligence</p>
              </div>
            </div>
          </div>

          {isCompanyRoute ? (
            <div className="mt-6 rounded-[30px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  <ArrowLeft size={12} />
                  Portfolio Home
                </Link>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                  Active workspace
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  Current company
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                  {activeCompany?.name ?? "Company workspace"}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  {activeCompany
                    ? `Workspace for ${activeCompany.name}`
                    : "Loading company context"}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  Company level
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  Portfolio separated
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[30px] border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Companies
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Select a company to open its dedicated workspace.
              </p>
            </div>
          )}

          <nav className="mt-6 space-y-2">
            {isCompanyRoute ? (
              <>
                <div className="rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Navigation
                </div>
                {companyNav.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={activeCompanyNavHref(item.href)}
                  />
                ))}

                <div className="mt-4 rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Companies
                </div>
                <div className="space-y-2 pl-1">
                  {companies.map((company) => {
                    const isActive = company.id === activeCompanyId

                    return (
                      <Link
                        key={company.id}
                        href={`/companies/${company.id}`}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                          isActive
                            ? "border border-sky-200 bg-sky-50/80 text-zinc-950 shadow-sm"
                            : "text-zinc-600 hover:bg-white/75 hover:text-zinc-950"
                        }`}
                      >
                        <Building2 size={16} className={isActive ? "text-sky-700" : "text-zinc-500"} />
                        <span className="truncate font-medium">{company.name}</span>
                        {isActive && (
                          <span className="ml-auto rounded-full border border-sky-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                            Active
                          </span>
                        )}
                      </Link>
                    )
                  })}
                  <Link
                    href="/companies/new"
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white hover:text-zinc-950"
                  >
                    <Plus size={16} />
                    <span>Add Company</span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Companies
                </div>
                <div className="space-y-2 pl-1">
                  {companies.map((company) => (
                    <Link
                      key={company.id}
                      href={`/companies/${company.id}`}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-zinc-600 transition hover:bg-white/70 hover:text-zinc-950"
                    >
                      <Building2 size={16} />
                      <span className="truncate">{company.name}</span>
                    </Link>
                  ))}
                  <Link
                    href="/companies/new"
                    className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                  >
                    <Plus size={16} />
                    <span>Add Company</span>
                  </Link>
                </div>
              </>
            )}
          </nav>

          <div className="mt-auto pt-8">
            {isCompanyRoute ? (
              <Link
                href="/"
                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                <ArrowLeft size={16} />
                Back to Portfolio Home
              </Link>
            ) : (
              <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <p className="text-sm font-semibold text-zinc-950">Portfolio Home</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Your portfolio command center is organized by company workspaces.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="px-6 py-7 md:px-8 xl:px-10">
          {isCompanyRoute && activeCompany && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm text-zinc-600 shadow-sm">
              <Link href="/" className="font-medium text-zinc-500 hover:text-zinc-950">
                Portfolio Home
              </Link>
              <span>/</span>
              <span className="font-medium text-zinc-950">{activeCompany.name}</span>
            </div>
          )}

          {loading && (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading workspace...</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && children}
        </section>
      </div>
    </main>
  )
}
