"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowRight, BookOpen, Package } from "lucide-react"
import CostingWorkspacePage from "@/components/costing-workspace-page"

function InsightCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  )
}

export default function IngredientsPage() {
  const params = useParams()
  const companyId = params.companyId as string

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Ingredients"
      subtitle="The company-scoped costing source of truth for flour, butter, milk, coffee, packaging, prep items, and any other input you buy."
      companyMeta="Ingredients will inherit their latest cost from purchase invoice lines while preserving price history for review."
      actions={
        <Link
          href={`/companies/${companyId}/costing/recipes`}
          className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          <BookOpen size={16} />
          Recipes
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InsightCard
          title="Latest price memory"
          description="Each ingredient card will surface the latest supplier, purchase date, ex VAT cost, and inc VAT cost so recipes stay linked to the newest paid price."
        />
        <InsightCard
          title="History preserved"
          description="Price history will stay in purchase invoice lines instead of being overwritten, making supplier comparisons and trend review possible later."
        />
        <InsightCard
          title="Recipe ready"
          description="The catalog is designed to support gram, ml, and unit-based costing without silently dropping missing price data to zero."
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-900 p-3 text-white">
              <Package size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Catalog design</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                Ingredients are the pricing source of truth
              </h2>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-zinc-600">
            Each ingredient will track its default costing unit, latest unit cost, supplier context, and most recent purchase date. This page is the bridge between supplier invoice history and recipe-level margin logic.
          </p>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
            <li>Default costing unit: `g`, `ml`, or `unit`</li>
            <li>Latest cost ex VAT and inc VAT</li>
            <li>Latest supplier and purchase date</li>
            <li>Category and notes for operator context</li>
            <li>Future-ready space for price trend and previous purchases</li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="border-b border-zinc-100 px-6 py-5">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Ingredient list preview</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This table will light up once purchase invoice lines start generating normalized ingredient prices.
            </p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Ingredient</th>
                <th className="px-6 py-4 font-medium">Unit</th>
                <th className="px-6 py-4 font-medium text-right">Latest ex VAT</th>
                <th className="px-6 py-4 font-medium text-right">Latest inc VAT</th>
                <th className="px-6 py-4 font-medium">Latest supplier</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100">
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  No ingredients tracked yet. Post purchase invoices to build the catalog.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <Link
          href={`/companies/${companyId}/costing/recipes`}
          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          Continue to recipes
          <ArrowRight size={16} />
        </Link>
      </div>
    </CostingWorkspacePage>
  )
}
