"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowRight, BookOpen, FileText, Package, Scale } from "lucide-react"
import CostingWorkspacePage from "@/components/costing-workspace-page"

function ModuleCard({
  href,
  title,
  description,
  eyebrow,
}: {
  href: string
  title: string
  description: string
  eyebrow: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-950">
        Open module
        <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function WorkflowStep({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{step}</p>
      <h3 className="mt-3 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  )
}

export default function CompanyCostingPage() {
  const params = useParams()
  const companyId = params.companyId as string

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Costing"
      subtitle="Build a company-level costing engine for supplier purchases, ingredient price memory, and recipe margin control."
      companyMeta="This workspace will hold purchase invoices, live ingredient pricing, and recipe costing sheets for this company."
      companyBadge={
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700">
          Phase 1 foundation
        </span>
      }
      actions={
        <>
          <Link
            href={`/companies/${companyId}/costing/purchase-invoices`}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            <FileText size={16} />
            Purchase invoices
          </Link>
          <Link
            href={`/companies/${companyId}/costing/recipes`}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            <BookOpen size={16} />
            Recipes
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafc_100%)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-900 p-3 text-white">
              <Scale size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Why this matters</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                Price memory should drive recipe discipline
              </h2>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-600">
            MarginFlow already knows your sales and weekly profitability. Costing adds the missing layer beneath that:
            what your ingredients cost now, how supplier prices are changing, and whether each recipe is still making sense at the current yield.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
              <p className="text-sm font-medium text-zinc-500">Purchase invoices</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Ready</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Register supplier purchases with normalized cost data.
              </p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
              <p className="text-sm font-medium text-zinc-500">Ingredients catalog</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Ready</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Keep the latest paid price and preserve historical lines.
              </p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
              <p className="text-sm font-medium text-zinc-500">Recipe sheets</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">Ready</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Calculate recipe cost ex VAT, inc VAT, and cost per yield.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Workflow map</p>
          <div className="mt-5 space-y-4">
            <WorkflowStep
              step="Step 1"
              title="Capture supplier purchases"
              description="Record invoice headers and line-level quantities so MarginFlow can normalize cost by gram, ml, or unit."
            />
            <WorkflowStep
              step="Step 2"
              title="Refresh ingredient prices"
              description="Latest paid price becomes the default live costing input, while the invoice history stays intact for audit and trend checks."
            />
            <WorkflowStep
              step="Step 3"
              title="Cost recipes with confidence"
              description="Recipes pull ingredient pricing automatically, then calculate total cost, per-yield cost, and food cost % when selling price is known."
            />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ModuleCard
          href={`/companies/${companyId}/costing/purchase-invoices`}
          eyebrow="Supplier capture"
          title="Purchase Invoices"
          description="The invoice register for flour, dairy, coffee, packaging, prep inputs, and any other production spend that should feed live costing."
        />
        <ModuleCard
          href={`/companies/${companyId}/costing/ingredients`}
          eyebrow="Source of truth"
          title="Ingredients"
          description="A company-scoped ingredient catalog driven by purchase history, latest paid price, and pricing visibility by supplier."
        />
        <ModuleCard
          href={`/companies/${companyId}/costing/recipes`}
          eyebrow="Recipe margin"
          title="Recipes"
          description="Recipe costing sheets for bakery, kitchen, drinks, and prep items with ex VAT, inc VAT, and cost-per-yield calculation."
        />
      </div>
    </CostingWorkspacePage>
  )
}
