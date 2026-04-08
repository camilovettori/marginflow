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
}

export default function WorkspacePageHeader({
  label,
  title,
  subtitle,
  companyName,
  companyMeta,
  companyBadge,
  actions,
}: WorkspacePageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:px-6 md:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            <span>{label}</span>
          </div>

          <div className="max-w-4xl">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 md:text-[3.35rem]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}

          {companyName ? (
            <div className="min-w-[250px] rounded-[24px] border border-zinc-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                  Selected company
                </p>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Active
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">{companyName}</p>
              {companyMeta ? (
                <p className="mt-1.5 text-sm leading-6 text-zinc-500">{companyMeta}</p>
              ) : null}
              {companyBadge ? <div className="mt-3">{companyBadge}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
