"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createWeeklyReport } from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Percent,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
} from "lucide-react"

const TENANT_ID = "ee8c5e98-427b-4ddc-9d02-9b797caf4447"

type CustomField = {
  id: string
  label: string
  amount: string
}

function createCustomField(): CustomField {
  return {
    id: crypto.randomUUID(),
    label: "",
    amount: "",
  }
}

function fmtMoneyInput(value: string) {
  return value
}

function parseMoney(value: string) {
  return Number(value || 0)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function getISOWeekInfo(dateString: string) {
  if (!dateString) return null

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  return {
    isoWeek: weekNo,
    isoYear: tmp.getUTCFullYear(),
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
      />
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-zinc-400">
        <span className="mr-2 text-sm text-zinc-500">€</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(fmtMoneyInput(e.target.value))}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none disabled:text-zinc-500"
        />
      </div>
    </div>
  )
}

function PercentField({
  label,
  value,
  onChange,
  placeholder = "30",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-zinc-400">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none"
        />
        <span className="ml-2 text-sm text-zinc-500">%</span>
      </div>
    </div>
  )
}

function InfoCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
    </div>
  )
}

function CustomFieldRow({
  label,
  amount,
  onLabelChange,
  onAmountChange,
  onRemove,
}: {
  label: string
  amount: string
  onLabelChange: (value: string) => void
  onAmountChange: (value: string) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
      <Field
        label="Field Name"
        value={label}
        onChange={onLabelChange}
        placeholder="e.g. Deliveroo, Catering, Packaging"
      />

      <MoneyField label="Amount" value={amount} onChange={onAmountChange} />

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

export default function NewWeeklyReportPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [weekEnding, setWeekEnding] = useState("")
  const [salesIncVat, setSalesIncVat] = useState("")
  const [salesExVat, setSalesExVat] = useState("")
  const [wages, setWages] = useState("")
  const [foodCostMode, setFoodCostMode] = useState<"manual" | "percent">("manual")
  const [foodCost, setFoodCost] = useState("")
  const [foodCostPercent, setFoodCostPercent] = useState("30")
  const [fixedCosts, setFixedCosts] = useState("")
  const [variableCosts, setVariableCosts] = useState("")
  const [loansHp, setLoansHp] = useState("")
  const [vatDue, setVatDue] = useState("")
  const [notes, setNotes] = useState("")
  const [customSalesFields, setCustomSalesFields] = useState<CustomField[]>([])
  const [customCostFields, setCustomCostFields] = useState<CustomField[]>([])

  const isoWeekInfo = useMemo(() => getISOWeekInfo(weekEnding), [weekEnding])

  const salesExVatNum = parseMoney(salesExVat)
  const wagesNum = parseMoney(wages)
  const fixedCostsNum = parseMoney(fixedCosts)
  const variableCostsNum = parseMoney(variableCosts)
  const loansHpNum = parseMoney(loansHp)
  const foodCostPercentNum = Number(foodCostPercent || 0)

  const customSalesTotal = useMemo(() => {
    return customSalesFields.reduce((sum, field) => sum + parseMoney(field.amount), 0)
  }, [customSalesFields])

  const customCostTotal = useMemo(() => {
    return customCostFields.reduce((sum, field) => sum + parseMoney(field.amount), 0)
  }, [customCostFields])

  const computedFoodCost = useMemo(() => {
    if (foodCostMode === "percent") {
      return salesExVatNum * (foodCostPercentNum / 100)
    }
    return parseMoney(foodCost)
  }, [foodCostMode, salesExVatNum, foodCostPercentNum, foodCost])

  const revenueBase = useMemo(() => {
    return salesExVatNum + customSalesTotal
  }, [salesExVatNum, customSalesTotal])

  const grossProfit = useMemo(() => {
    return revenueBase - computedFoodCost
  }, [revenueBase, computedFoodCost])

  const netProfit = useMemo(() => {
    return (
      grossProfit -
      wagesNum -
      fixedCostsNum -
      variableCostsNum -
      loansHpNum -
      customCostTotal
    )
  }, [grossProfit, wagesNum, fixedCostsNum, variableCostsNum, loansHpNum, customCostTotal])

  const wagesPct = useMemo(() => {
    if (revenueBase <= 0) return 0
    return wagesNum / revenueBase
  }, [revenueBase, wagesNum])

  const grossMarginPct = useMemo(() => {
    if (revenueBase <= 0) return 0
    return grossProfit / revenueBase
  }, [revenueBase, grossProfit])

  const netMarginPct = useMemo(() => {
    if (revenueBase <= 0) return 0
    return netProfit / revenueBase
  }, [revenueBase, netProfit])

  async function handleSave() {
    try {
      setSaveError(null)

      if (!weekEnding) {
        throw new Error("Please select the week ending date.")
      }

      if (revenueBase <= 0) {
        throw new Error("Sales ex VAT must be greater than zero.")
      }

      setSaving(true)

      const cleanedCustomSalesFields = customSalesFields
        .map((field) => ({
          label: field.label.trim(),
          amount: Number(field.amount || 0),
        }))
        .filter((field) => field.label || field.amount > 0)

      const cleanedCustomCostFields = customCostFields
        .map((field) => ({
          label: field.label.trim(),
          amount: Number(field.amount || 0),
        }))
        .filter((field) => field.label || field.amount > 0)

      const metadataNotes = [
        notes.trim() ? `User notes:\n${notes.trim()}` : "",
        isoWeekInfo ? `ISO week: ${isoWeekInfo.isoWeek}/${isoWeekInfo.isoYear}` : "",
        `Food cost mode: ${foodCostMode}`,
        foodCostMode === "percent" ? `Food cost percent: ${foodCostPercentNum}%` : "",
        cleanedCustomSalesFields.length
          ? `Custom sales fields: ${JSON.stringify(cleanedCustomSalesFields)}`
          : "",
        cleanedCustomCostFields.length
          ? `Custom cost fields: ${JSON.stringify(cleanedCustomCostFields)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      await createWeeklyReport(
        {
          company_id: companyId,
          week_ending: weekEnding,
          sales_inc_vat: Number(salesIncVat || 0),
          sales_ex_vat: Number(revenueBase.toFixed(2)),
          wages: wagesNum,
          holiday_pay: 0,
          food_cost: Number(computedFoodCost.toFixed(2)),
          fixed_costs: fixedCostsNum,
          variable_costs: Number((variableCostsNum + customCostTotal).toFixed(2)),
          loans_hp: loansHpNum,
          vat_due: Number(vatDue || 0),
          notes: metadataNotes || undefined,
        },
        TENANT_ID
      )

      router.push(`/companies/${companyId}`)
    } catch (err) {
      console.error("Save weekly report error:", err)
      setSaveError(err instanceof Error ? err.message : "Failed to save weekly report.")
    } finally {
      setSaving(false)
    }
  }

  function addCustomSalesField() {
    setCustomSalesFields((prev) => [...prev, createCustomField()])
  }

  function addCustomCostField() {
    setCustomCostFields((prev) => [...prev, createCustomField()])
  }

  function updateCustomSalesField(id: string, patch: Partial<CustomField>) {
    setCustomSalesFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...patch } : field))
    )
  }

  function updateCustomCostField(id: string, patch: Partial<CustomField>) {
    setCustomCostFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...patch } : field))
    )
  }

  function removeCustomSalesField(id: string) {
    setCustomSalesFields((prev) => prev.filter((field) => field.id !== id))
  }

  function removeCustomCostField(id: string) {
    setCustomCostFields((prev) => prev.filter((field) => field.id !== id))
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(244,244,245,1)_40%,_rgba(240,240,243,1)_100%)] text-zinc-950">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[300px_1fr]">
        <aside className="flex min-h-screen flex-col border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,244,246,0.86))] px-5 py-7 backdrop-blur">
          <div className="rounded-[32px] border border-white/70 bg-white/50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">MarginFlow</h1>
                <p className="text-sm text-zinc-500">Margin intelligence</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            <Link
              href="/"
              className="block rounded-2xl px-4 py-3 text-sm text-zinc-500 transition hover:bg-white/70"
            >
              <div className="flex items-center gap-3">
                <BarChart3 size={16} />
                Dashboard
              </div>
            </Link>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Companies</div>

            <div className="space-y-2 pl-3">
              <Link
                href={`/companies/${companyId}`}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm text-zinc-950 shadow-sm ring-1 ring-zinc-200"
              >
                <Building2 size={16} />
                <span className="truncate">Company page</span>
              </Link>
            </div>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Weekly Reports</div>
            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Analytics</div>
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">New Weekly Report</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Feed the system with weekly financial data.
            </p>
          </div>

          <div className="mt-auto pt-8">
            <button className="flex w-full items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white">
              <Settings size={16} />
              Settings
            </button>
          </div>
        </aside>

        <section className="px-6 py-7 md:px-8 xl:px-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4">
                <Link
                  href={`/companies/${companyId}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to Company
                </Link>
              </div>

              <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                Add Weekly Report
              </h2>
              <p className="mt-3 text-base text-zinc-500">
                Enter the weekly numbers for this company.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-500 shadow-sm">
                <Search size={18} />
              </button>
              <button className="rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-500 shadow-sm">
                <Bell size={18} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Report"}
              </button>
            </div>
          </div>

          {saveError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              title="Gross Profit"
              value={formatMoney(grossProfit)}
              subtitle="Revenue base minus food cost"
            />
            <InfoCard
              title="Net Profit"
              value={formatMoney(netProfit)}
              subtitle="After wages and operating costs"
            />
            <InfoCard
              title="Wages %"
              value={formatPct(wagesPct)}
              subtitle="Labour pressure vs revenue"
            />
            <InfoCard
              title="Net Margin"
              value={formatPct(netMarginPct)}
              subtitle="Bottom-line efficiency"
            />
          </div>

          <div className="mt-8 rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
            <div className="border-b border-zinc-100 px-7 py-6">
              <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                Weekly Report Form
              </h3>
              <p className="mt-1.5 text-sm text-zinc-500">
                Fill in the weekly financial inputs below.
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="space-y-5">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CalendarDays size={16} className="text-zinc-600" />
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                        Week Details
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field
                        label="Week Ending"
                        type="date"
                        value={weekEnding}
                        onChange={setWeekEnding}
                      />

                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                        <p className="text-sm font-medium text-zinc-700">ISO Week</p>
                        <p className="mt-2 text-sm text-zinc-500">
                          {isoWeekInfo
                            ? `Week ${isoWeekInfo.isoWeek} / ${isoWeekInfo.isoYear}`
                            : "Select a date"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Plus size={16} className="text-zinc-600" />
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                          Sales
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={addCustomSalesField}
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Plus size={14} />
                        Add Sales Field
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <MoneyField
                        label="Sales inc VAT"
                        value={salesIncVat}
                        onChange={setSalesIncVat}
                      />
                      <MoneyField
                        label="Sales ex VAT"
                        value={salesExVat}
                        onChange={setSalesExVat}
                      />
                    </div>

                    {customSalesFields.length > 0 && (
                      <div className="mt-5 space-y-4 border-t border-zinc-200 pt-5">
                        {customSalesFields.map((field) => (
                          <CustomFieldRow
                            key={field.id}
                            label={field.label}
                            amount={field.amount}
                            onLabelChange={(value) =>
                              updateCustomSalesField(field.id, { label: value })
                            }
                            onAmountChange={(value) =>
                              updateCustomSalesField(field.id, { amount: value })
                            }
                            onRemove={() => removeCustomSalesField(field.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-zinc-600" />
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                          Operating Costs
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={addCustomCostField}
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <Plus size={14} />
                        Add Cost Field
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <MoneyField label="Wages" value={wages} onChange={setWages} />

                      <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-zinc-700">Food Cost</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              Use a manual value or calculate it from sales percentage.
                            </p>
                          </div>

                          <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                            <button
                              type="button"
                              onClick={() => setFoodCostMode("manual")}
                              className={`rounded-xl px-3 py-2 text-sm transition ${
                                foodCostMode === "manual"
                                  ? "bg-white text-zinc-950 shadow-sm"
                                  : "text-zinc-500"
                              }`}
                            >
                              Manual
                            </button>
                            <button
                              type="button"
                              onClick={() => setFoodCostMode("percent")}
                              className={`rounded-xl px-3 py-2 text-sm transition ${
                                foodCostMode === "percent"
                                  ? "bg-white text-zinc-950 shadow-sm"
                                  : "text-zinc-500"
                              }`}
                            >
                              % of Sales
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {foodCostMode === "manual" ? (
                            <MoneyField
                              label="Food Cost"
                              value={foodCost}
                              onChange={setFoodCost}
                            />
                          ) : (
                            <>
                              <PercentField
                                label="Food Cost %"
                                value={foodCostPercent}
                                onChange={setFoodCostPercent}
                              />
                              <MoneyField
                                label="Calculated Food Cost"
                                value={computedFoodCost.toFixed(2)}
                                onChange={() => {}}
                                disabled
                              />
                            </>
                          )}
                        </div>
                      </div>

                      <MoneyField
                        label="Fixed Costs"
                        value={fixedCosts}
                        onChange={setFixedCosts}
                      />
                      <MoneyField
                        label="Variable Costs"
                        value={variableCosts}
                        onChange={setVariableCosts}
                      />
                      <MoneyField label="Loans / HP" value={loansHp} onChange={setLoansHp} />
                      <MoneyField label="VAT Due" value={vatDue} onChange={setVatDue} />
                    </div>

                    {customCostFields.length > 0 && (
                      <div className="mt-5 space-y-4 border-t border-zinc-200 pt-5">
                        {customCostFields.map((field) => (
                          <CustomFieldRow
                            key={field.id}
                            label={field.label}
                            amount={field.amount}
                            onLabelChange={(value) =>
                              updateCustomCostField(field.id, { label: value })
                            }
                            onAmountChange={(value) =>
                              updateCustomCostField(field.id, { amount: value })
                            }
                            onRemove={() => removeCustomCostField(field.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Percent size={16} className="text-zinc-600" />
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                        Live Margin Preview
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InfoCard
                        title="Gross Margin"
                        value={formatPct(grossMarginPct)}
                        subtitle="Gross profit as % of revenue"
                      />
                      <InfoCard
                        title="Net Margin"
                        value={formatPct(netMarginPct)}
                        subtitle="Net profit as % of revenue"
                      />
                      <InfoCard
                        title="Custom Sales"
                        value={formatMoney(customSalesTotal)}
                        subtitle="Additional revenue fields total"
                      />
                      <InfoCard
                        title="Custom Costs"
                        value={formatMoney(customCostTotal)}
                        subtitle="Additional cost fields total"
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                    <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-700">
                      Notes
                    </h4>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Weekly Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={8}
                      placeholder="Optional notes about the week, anomalies, events, promotions, staffing issues..."
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                    />
                  </div>

                  <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                      Recommended use
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-amber-900">
                      Keep the core fields standardized, then use custom fields for client-specific
                      items. That gives flexibility without turning the report into chaos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? "Saving Weekly Report..." : "Save Weekly Report"}
                </button>

                <Link
                  href={`/companies/${companyId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}