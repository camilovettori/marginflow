"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowRight, BookOpen, FileText, Scale } from "lucide-react"
import CostingWorkspacePage from "@/components/costing-workspace-page"

function MetricTile({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
    </div>
  )
}

export default function RecipesPage() {
  const params = useParams()
  const companyId = params.companyId as string

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Recipes"
      subtitle="Create recipe costing sheets that pull the latest ingredient prices automatically and calculate total cost, yield cost, and margin signals."
      companyMeta="Internal naming stays clean as Recipes. If you want the brand label later, this module can surface as ZRecipe without changing the data model."
      actions={
        <Link
          href={`/companies/${companyId}/costing/purchase-invoices`}
          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          <FileText size={16} />
          Invoice source
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricTile
          title="Recipe sheets"
          value="0"
          subtitle="No saved costing sheets yet for this company."
        />
        <MetricTile
          title="Missing prices"
          value="0"
          subtitle="Missing ingredient cost warnings will surface here."
        />
        <MetricTile
          title="Margin ready"
          value="Live"
          subtitle="Selling price, food cost %, markup, and margin will calculate once recipes exist."
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-zinc-900 p-3 text-white">
              <BookOpen size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Recipe costing</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                Turn ingredient prices into recipe discipline
              </h2>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-zinc-600">
            Recipes will inherit latest normalized ingredient costs, then calculate total recipe cost ex VAT, inc VAT, cost per yield, cost per portion, and optional gross margin signals when selling price is present.
          </p>

          <div className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5">
            <p className="text-sm font-semibold text-zinc-950">Planned recipe sheet fields</p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Yield, portion size, wastage %, category, active/inactive state, selling price, target food cost %, packaging override, and labour override fields are all part of the intended first costing model.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <Scale size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Live cost behavior</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                Cost sheets should stay connected to reality
              </h2>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
            <li>Latest paid price drives default costing</li>
            <li>Missing price data should show warnings, never silent zeroes</li>
            <li>Price provenance remains visible to the operator</li>
            <li>Recipe totals should refresh automatically as newer purchase lines arrive</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-dashed border-zinc-300 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Empty state</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">No recipes costed yet</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-500">
          Once recipe sheets are enabled, this page will show company recipes, missing-cost warnings, and quick links into individual recipe detail editors.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href={`/companies/${companyId}/costing/recipes/template-preview`}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-white hover:text-zinc-950"
          >
            Preview recipe detail shell
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </CostingWorkspacePage>
  )
}
