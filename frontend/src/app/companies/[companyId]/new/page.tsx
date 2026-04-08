"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  createWeeklyReport,
  getCompanyById,
  getZohoWeeklyPrefill,
  type Company,
} from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Percent,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Wallet,
  TrendingUp,
  RefreshCw,
} from "lucide-react"
import WorkspacePageHeader from "@/components/workspace-page-header"

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

  const monday = new Date(date)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    isoWeek: weekNo,
    isoYear: tmp.getUTCFullYear(),
    start: new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(monday),
    end: new Intl.DateTimeFormat("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(sunday),
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
          onChange={(e) => onChange(e.target.value)}
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

function MetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-500">{title}</p>
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

  const [company, setCompany] = useState<Company | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null)
  const [prefillApplied, setPrefillApplied] = useState(false)
  const lastPrefillWeekRef = useRef<string>("")

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

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoadingCompany(true)
        const data = await getCompanyById(companyId)
        setCompany(data)
      } catch (err) {
        console.error("Load company error:", err)
      } finally {
        setLoadingCompany(false)
      }
    }

    loadCompany()
  }, [companyId])

  useEffect(() => {
    async function tryZohoPrefill() {
      if (!company) return
      if (company.sales_source !== "zoho") return
      if (!weekEnding) return
      if (lastPrefillWeekRef.current === weekEnding) return

      try {
        setPrefillLoading(true)
        setPrefillMessage(null)

        const result = await getZohoWeeklyPrefill(companyId, weekEnding)
        lastPrefillWeekRef.current = weekEnding

        if (!result.found) {
          setPrefillApplied(false)
          setPrefillMessage("No Zoho invoice data found for this week.")
          return
        }

        setSalesIncVat(String(result.sales_inc_vat || 0))
        setSalesExVat(String(result.sales_ex_vat || 0))

        setNotes((prev) => {
          const current = (prev || "").trim()
          const zohoNote = result.notes || "Imported from Zoho Invoice prefill"

          if (current.toLowerCase().includes("zoho")) return prev
          if (!current) return zohoNote
          return `${zohoNote}\n\n${current}`
        })

        setPrefillApplied(true)
        setPrefillMessage("Zoho sales prefill applied for the selected week.")
      } catch (err) {
        console.error("Zoho prefill error:", err)
        setPrefillApplied(false)
        setPrefillMessage(
          err instanceof Error ? err.message : "Failed to load Zoho prefill."
        )
      } finally {
        setPrefillLoading(false)
      }
    }

    tryZohoPrefill()
  }, [company, companyId, weekEnding])

  const isoWeekInfo = useMemo(() => getISOWeekInfo(weekEnding), [weekEnding])

  const salesExVatNum = parseMoney(salesExVat)
  const wagesNum = parseMoney(wages)
  const fixedCostsNum = parseMoney(fixedCosts)
  const variableCostsNum = parseMoney(variableCosts)
  const loansHpNum = parseMoney(loansHp)
  const vatDueNum = parseMoney(vatDue)
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

  const labourTotal = useMemo(() => wagesNum, [wagesNum])

  const grossProfit = useMemo(() => {
    return revenueBase - computedFoodCost
  }, [revenueBase, computedFoodCost])

  const netProfit = useMemo(() => {
    return (
      grossProfit -
      labourTotal -
      fixedCostsNum -
      variableCostsNum -
      loansHpNum -
      customCostTotal -
      vatDueNum
    )
  }, [grossProfit, labourTotal, fixedCostsNum, variableCostsNum, loansHpNum, customCostTotal, vatDueNum])

  const wagesPct = useMemo(() => {
    if (revenueBase <= 0) return 0
    return labourTotal / revenueBase
  }, [revenueBase, labourTotal])

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

      if (salesExVatNum <= 0) {
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
        company?.sales_source === "zoho" && prefillApplied ? "Source: Zoho prefill" : "",
        cleanedCustomSalesFields.length
          ? `Custom sales fields: ${JSON.stringify(cleanedCustomSalesFields)}`
          : "",
        cleanedCustomCostFields.length
          ? `Custom cost fields: ${JSON.stringify(cleanedCustomCostFields)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      await createWeeklyReport({
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
        vat_due: vatDueNum,
        notes: metadataNotes || undefined,
      })

      router.push(`/companies/${companyId}/reports`)
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
    <div className="space-y-8">
      <WorkspacePageHeader
        label="Weekly report creation"
        title="Add Weekly Report"
        subtitle={`Structured input for sales, operating costs and live margin preview for ${company?.name ?? "this company"}.`}
        companyName={loadingCompany ? "Loading..." : company?.name || "Selected Company"}
        companyMeta="Create a company-scoped weekly report with sales, margins, and cost detail."
        companyBadge={
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Draft workspace
          </span>
        }
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Report"}
          </button>
        }
      />

      <div className="hidden mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4">
                <Link
                  href={`/companies/${companyId}/reports`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to Weekly Reports
                </Link>
              </div>

              <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                {loadingCompany ? "Loading..." : company?.name || "Selected Company"} — Add Weekly Report
              </h2>
              <p className="mt-3 max-w-3xl text-base text-zinc-600">
                Structured input for sales, operating costs and live margin preview.
              </p>
            </div>

            <div className="flex items-center gap-3">
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

          {prefillMessage && (
            <div
              className={`mb-6 rounded-2xl border p-4 ${
                prefillApplied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }`}
            >
              <div className="flex items-center gap-2">
                {prefillLoading && <RefreshCw size={16} className="animate-spin" />}
                <span>{prefillMessage}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Wallet size={18} />}
              title="Revenue Base"
              value={formatMoney(revenueBase)}
              subtitle="Sales ex VAT + custom sales"
            />
            <MetricCard
              icon={<TrendingUp size={18} />}
              title="Gross Profit"
              value={formatMoney(grossProfit)}
              subtitle="Revenue minus food cost"
            />
            <MetricCard
              icon={<Percent size={18} />}
              title="Net Margin"
              value={formatPct(netMarginPct)}
              subtitle="Bottom-line efficiency"
            />
            <MetricCard
              icon={<Building2 size={18} />}
              title="Labour %"
              value={formatPct(wagesPct)}
              subtitle="Labour pressure vs revenue"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <CalendarDays size={16} className="text-zinc-600" />
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                    Week Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Week Ending"
                    type="date"
                    value={weekEnding}
                    onChange={(value) => {
                      setWeekEnding(value)
                      setPrefillApplied(false)
                      setPrefillMessage(null)
                      lastPrefillWeekRef.current = ""
                    }}
                  />

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-700">ISO Week</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {isoWeekInfo
                        ? `Week ${isoWeekInfo.isoWeek} / ${isoWeekInfo.isoYear}`
                        : "Select a date"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {isoWeekInfo ? `${isoWeekInfo.start} → ${isoWeekInfo.end}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      Sales
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Core weekly sales inputs plus optional custom revenue fields.
                    </p>
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

              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      Operational Costs
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Standard cost structure with flexible add-on fields.
                    </p>
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

                  <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-700">Food Cost</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          Use a manual amount or calculate from sales percentage.
                        </p>
                      </div>

                      <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
                        <button
                          type="button"
                          onClick={() => setFoodCostMode("manual")}
                          className={`rounded-xl px-3 py-2 text-sm transition ${
                            foodCostMode === "manual"
                              ? "bg-zinc-950 text-white shadow-sm"
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
                              ? "bg-zinc-950 text-white shadow-sm"
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

            <div className="space-y-6">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-950">
                  <Sparkles size={18} />
                  Live Margin Preview
                </h3>

                <div className="mt-5 grid grid-cols-1 gap-4">
                  <MetricCard
                    icon={<TrendingUp size={18} />}
                    title="Gross Margin"
                    value={formatPct(revenueBase > 0 ? grossProfit / revenueBase : 0)}
                    subtitle="Gross profit as % of revenue"
                  />
                  <MetricCard
                    icon={<Percent size={18} />}
                    title="Net Margin"
                    value={formatPct(netMarginPct)}
                    subtitle="Net profit as % of revenue"
                  />
                  <MetricCard
                    icon={<Wallet size={18} />}
                    title="Custom Sales"
                    value={formatMoney(customSalesTotal)}
                    subtitle="Additional revenue fields"
                  />
                  <MetricCard
                    icon={<Building2 size={18} />}
                    title="Custom Costs"
                    value={formatMoney(customCostTotal)}
                    subtitle="Additional cost fields"
                  />
                </div>
              </div>

              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                  Notes
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Optional context for anomalies, promotions, staffing issues or operational observations.
                </p>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  placeholder="Optional notes about the week..."
                  className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
                />
              </div>

              <div className="rounded-[30px] border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                  Zoho prefill
                </h3>
                <p className="mt-3 text-sm leading-6 text-amber-900">
                  If this company is connected to Zoho, selecting the week ending date will automatically try to prefill sales for that week.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? "Saving Weekly Report..." : "Save Weekly Report"}
                </button>

                <Link
                  href={`/companies/${companyId}/reports`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </div>
    </div>
  )
}
