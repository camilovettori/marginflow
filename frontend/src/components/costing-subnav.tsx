"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { BookOpen, FileText, Package } from "lucide-react"

type CostingSubnavProps = {
  companyId: string
}

type CostingNavItem = {
  href: string
  label: string
  icon: ReactNode
  match: (pathname: string) => boolean
}

function CostingNavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
      }`}
    >
      <span className={active ? "text-white" : "text-zinc-500"}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

export default function CostingSubnav({ companyId }: CostingSubnavProps) {
  const pathname = usePathname()
  const baseHref = `/companies/${companyId}/costing`

  const items: CostingNavItem[] = [
    {
      href: `${baseHref}/purchase-invoices`,
      label: "Purchase Invoices",
      icon: <FileText size={15} />,
      match: (currentPath) => currentPath.startsWith(`${baseHref}/purchase-invoices`),
    },
    {
      href: `${baseHref}/ingredients`,
      label: "Ingredients",
      icon: <Package size={15} />,
      match: (currentPath) => currentPath.startsWith(`${baseHref}/ingredients`),
    },
    {
      href: `${baseHref}/recipes`,
      label: "Recipes",
      icon: <BookOpen size={15} />,
      match: (currentPath) => currentPath.startsWith(`${baseHref}/recipes`),
    },
  ]

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Costing workspace
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Supplier invoices, ingredient pricing, and recipe cost sheets will all live in this company-scoped workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <CostingNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.match(pathname)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
