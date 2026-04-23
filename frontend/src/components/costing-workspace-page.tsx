"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getCompanyById, type Company } from "@/services/api"
import WorkspacePageHeader from "@/components/workspace-page-header"
import CostingSubnav from "@/components/costing-subnav"

type CostingWorkspacePageProps = {
  companyId: string
  title: ReactNode
  subtitle: ReactNode
  label?: string
  companyMeta?: ReactNode
  companyBadge?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export default function CostingWorkspacePage({
  companyId,
  title,
  subtitle,
  label = "Costing workspace",
  companyMeta = "Supplier pricing, ingredient cost memory, and recipe costing for this company.",
  companyBadge,
  actions,
  children,
}: CostingWorkspacePageProps) {
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoading(true)
        setError(null)
        const companyData = await getCompanyById(companyId)
        setCompany(companyData)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load costing workspace."

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

    loadCompany()
  }, [companyId, router])

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        label={label}
        title={title}
        subtitle={subtitle}
        companyName={company?.name ?? "Loading company..."}
        companyMeta={companyMeta}
        companyBadge={
          companyBadge ?? (
            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Company scoped
            </span>
          )
        }
        actions={actions}
      />

      <CostingSubnav companyId={companyId} />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-zinc-500">Loading costing workspace...</p>
        </div>
      ) : null}

      {!loading && !error ? children : null}
    </div>
  )
}
