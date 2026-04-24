"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  FileText,
  Grid3X3,
  Home,
  Plus,
  Scale,
  Settings2,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { getCompanies, getMe, type Company } from "@/services/api"

type WorkspaceMode = "tenant" | "company"

type WorkspaceShellProps = {
  mode: WorkspaceMode
  activeCompanyId?: string
  children: React.ReactNode
}

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  activeWhen?: (pathname: string) => boolean
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return "CO"

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function CompanyAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[#111111] text-[10px] font-semibold leading-none text-white">
      {getInitials(name)}
    </div>
  )
}

function SidebarNavLink({
  href,
  label,
  icon,
  active,
  indicator,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active?: boolean
  indicator?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition ${
        active
          ? "bg-[color:var(--color-background-secondary)] font-medium text-[color:var(--color-text-primary)]"
          : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-background-secondary)] hover:text-[color:var(--color-text-primary)]"
      }`}
    >
      <span className={active ? "opacity-100" : "opacity-60"}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {indicator}
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
  const switcherRef = useRef<HTMLDivElement | null>(null)

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)

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

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!switcherRef.current) return
      if (!switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSwitcherOpen(false)
      }
    }

    document.addEventListener("mousedown", handleDocumentClick)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  useEffect(() => {
    setSwitcherOpen(false)
  }, [activeCompanyId, pathname])

  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return null
    return companies.find((company) => company.id === activeCompanyId) ?? null
  }, [activeCompanyId, companies])

  const selectedCompany = activeCompany ?? companies[0] ?? null
  const isCompanyRoute = mode === "company"
  const companyBaseHref = activeCompanyId ? `/companies/${activeCompanyId}` : "/companies"
  const isCostingActive = pathname.startsWith(`${companyBaseHref}/costing`)

  const companyNav = useMemo<NavItem[]>(
    () => [
      {
        href: companyBaseHref,
        label: "Home",
        icon: <Home size={15} strokeWidth={1.8} />,
        activeWhen: (currentPathname) => currentPathname === companyBaseHref,
      },
      {
        href: `${companyBaseHref}/sales`,
        label: "Sales",
        icon: <Wallet size={15} strokeWidth={1.8} />,
      },
      {
        href: `${companyBaseHref}/costing/purchase-invoices`,
        label: "Costing",
        icon: <Scale size={15} strokeWidth={1.8} />,
        activeWhen: (currentPathname) =>
          currentPathname === `${companyBaseHref}/costing` ||
          currentPathname.startsWith(`${companyBaseHref}/costing/`),
      },
      {
        href: `${companyBaseHref}/comparison`,
        label: "Company comparison",
        icon: <ArrowLeftRight size={15} strokeWidth={1.8} />,
      },
      {
        href: `${companyBaseHref}/reports`,
        label: "Weekly reports",
        icon: <FileText size={15} strokeWidth={1.8} />,
      },
      {
        href: `${companyBaseHref}/analytics`,
        label: "Analytics",
        icon: <TrendingUp size={15} strokeWidth={1.8} />,
      },
      {
        href: `${companyBaseHref}/budget-forecast`,
        label: "Budget / forecast",
        icon: <Target size={15} strokeWidth={1.8} />,
      },
      {
        href: `${companyBaseHref}/settings`,
        label: "Settings",
        icon: <Settings2 size={15} strokeWidth={1.8} />,
      },
    ],
    [companyBaseHref]
  )

  const handleCompanySelect = (companyId: string) => {
    setSwitcherOpen(false)
    router.push(`/companies/${companyId}`)
  }

  const activeCompanyNavHref = (item: NavItem) => {
    if (item.activeWhen) return item.activeWhen(pathname)
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[color:var(--color-background-primary)] text-[color:var(--color-text-primary)]">
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:flex-row">
        <aside className="flex w-full flex-col border-r-0 border-b border-[color:var(--color-border-tertiary)] bg-[color:var(--color-background-primary)] lg:h-[calc(100dvh-4rem)] lg:w-[220px] lg:border-b-0 lg:border-r-[0.5px] lg:border-r-[color:var(--color-border-tertiary)]">
          <div className="flex h-[52px] items-center gap-3 border-b border-[color:var(--color-border-tertiary)] px-4">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[#111111] text-white">
              <Grid3X3 size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium leading-none text-[color:var(--color-text-primary)]">
                MarginFlow
              </p>
              <p className="mt-1 text-[11px] leading-none text-[color:var(--color-text-muted)]">
                Margin intelligence
              </p>
            </div>
          </div>

          <div ref={switcherRef} className="relative border-b border-[color:var(--color-border-tertiary)] px-3 py-3">
            <button
              type="button"
              onClick={() => setSwitcherOpen((current) => !current)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--color-background-secondary)]"
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
            >
              <CompanyAvatar name={selectedCompany?.name ?? "Company"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--color-text-primary)]">
                    {selectedCompany?.name ?? "Select company"}
                  </span>
                  {activeCompany ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#639922]" /> : null}
                </div>
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 text-[color:var(--color-text-muted)] transition-transform ${
                  switcherOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {switcherOpen ? (
              <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-50 rounded-[10px] border-[0.5px] border-[color:var(--color-border-tertiary)] bg-[color:var(--color-background-primary)] shadow-none">
                <div className="px-3 pb-2 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                    Companies
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto px-2 pb-2">
                  <div className="space-y-1">
                    {companies.map((company) => {
                      const isActive = company.id === activeCompanyId

                      return (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleCompanySelect(company.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition hover:bg-[color:var(--color-background-secondary)]"
                        >
                          <CompanyAvatar name={company.name} />
                          <span className="min-w-0 flex-1 truncate text-[color:var(--color-text-primary)]">
                            {company.name}
                          </span>
                          {isActive ? <Check size={14} className="text-[#639922]" /> : null}
                        </button>
                      )
                    })}
                  </div>

                  <div className="my-2 border-t border-[color:var(--color-border-tertiary)]" />

                  <Link
                    href="/companies/new"
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[color:var(--color-border-tertiary)] px-2 py-2 text-[13px] text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-background-secondary)] hover:text-[color:var(--color-text-primary)]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-dashed border-[color:var(--color-border-tertiary)]">
                      <Plus size={12} />
                    </span>
                    <span className="truncate">Add company</span>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <div className="space-y-1">
              {isCompanyRoute
                ? companyNav.map((item) => (
                    <SidebarNavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={activeCompanyNavHref(item)}
                      indicator={
                        item.label === "Costing" && isCostingActive ? (
                          <span className="h-2 w-2 rounded-full bg-[#9bbd63]" />
                        ) : null
                      }
                    />
                  ))
                : null}
            </div>
          </nav>

          <div className="border-t border-[color:var(--color-border-tertiary)] p-3">
            {isCompanyRoute ? (
              <div className="flex items-center gap-2 rounded-xl bg-[color:var(--color-background-secondary)] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-[#639922]" />
                <span className="text-[11px] text-[color:var(--color-text-muted)]">
                  Active workspace {"\u00B7"}{" "}
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    Company level
                  </span>
                </span>
              </div>
            ) : (
              <div className="rounded-xl bg-[color:var(--color-background-secondary)] px-3 py-2 text-[11px] text-[color:var(--color-text-muted)]">
                Portfolio home
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          {loading && (
            <div className="rounded-[28px] border border-[color:var(--color-border-tertiary)] bg-[color:var(--color-background-primary)] p-8">
              <p className="text-[color:var(--color-text-muted)]">Loading workspace...</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error ? children : null}
        </section>
      </div>
    </main>
  )
}
