"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, BookOpen, Scale } from "lucide-react"
import CostingWorkspacePage from "@/components/costing-workspace-page"

function SummaryCard({
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

export default function RecipeDetailPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const recipeId = params.recipeId as string

  return (
    <CostingWorkspacePage
      companyId={companyId}
      title="Recipe Detail"
      subtitle="A clean recipe editor shell for ingredient rows, live recalculation, and pricing provenance."
      companyMeta={`Previewing recipe route structure for ${recipeId}. This page is ready for company-scoped recipe editors and future live data.`}
      actions={
        <Link
          href={`/companies/${companyId}/costing/recipes`}
          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          <ArrowLeft size={16} />
          Back to recipes
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-zinc-900 p-3 text-white">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Recipe editor shell</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  Recipe info and method will live here
                </h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-600">
              This route is in place for the future live editor. It will hold recipe metadata, yield settings, optional pricing targets, and the ingredient lines that roll up into food cost and margin calculations.
            </p>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-zinc-100 px-6 py-5">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Ingredient lines</h2>
              <p className="mt-1 text-sm text-zinc-500">
                The future editor will show ingredient quantity, unit used, latest normalized price, and line cost here.
              </p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Ingredient</th>
                  <th className="px-6 py-4 font-medium">Qty</th>
                  <th className="px-6 py-4 font-medium text-right">Unit cost ex VAT</th>
                  <th className="px-6 py-4 font-medium text-right">Line cost ex VAT</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-zinc-100">
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    Recipe ingredients will appear here once the recipe model is active.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <Scale size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Summary card</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  Live costing summary belongs here
                </h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-600">
              The first recipe editor will calculate total recipe cost ex VAT, inc VAT, cost per yield, cost per portion, and optional gross margin metrics if a selling price is present.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
            <SummaryCard title="Recipe cost ex VAT" value="--" subtitle="Calculated from latest ingredient purchase prices." />
            <SummaryCard title="Recipe cost inc VAT" value="--" subtitle="Useful when suppliers invoice with VAT included." />
            <SummaryCard title="Cost per yield" value="--" subtitle="Derived from total recipe cost and configured yield." />
            <SummaryCard title="Food cost %" value="--" subtitle="Unlocked once the recipe has a selling price." />
          </div>
        </div>
      </div>
    </CostingWorkspacePage>
  )
}
