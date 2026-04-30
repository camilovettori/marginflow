"use client"

import type { ReactNode } from "react"

type WorkspacePageHeaderProps = {
  label: string
  title: ReactNode
  subtitle?: ReactNode
  companyName?: ReactNode
  companyMeta?: ReactNode
  companyBadge?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

export default function WorkspacePageHeader({
  label,
  title,
  subtitle,
  actions,
  compact = false,
}: WorkspacePageHeaderProps) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white shadow-none ${compact ? "px-3 py-3 md:px-4 md:py-3" : "px-4 py-4 md:px-5 md:py-4"}`}>
      <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-3"} lg:flex-row lg:items-start lg:justify-between`}>
        <div className={`min-w-0 ${compact ? "space-y-1.5" : "space-y-2"}`}>
          <div className={`inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 ${compact ? "px-2 py-0.5" : "px-2.5 py-1"} text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500`}>
            <span>{label}</span>
          </div>

          <div className="max-w-4xl">
            <h1 className={`font-semibold tracking-tight text-zinc-950 ${compact ? "text-[2.1rem] md:text-[2.25rem]" : "text-3xl md:text-[2.55rem]"}`}>
              {title}
            </h1>
            {subtitle ? (
              <p className={`max-w-3xl text-sm leading-6 text-zinc-500 ${compact ? "mt-1.5" : "mt-2"}`}>{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className={`flex shrink-0 flex-col items-start ${compact ? "gap-1.5" : "gap-2"} lg:items-end`}>
          {actions ? <div className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>{actions}</div> : null}
        </div>
      </div>
    </div>
  )
}
