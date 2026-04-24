type MonthlyBudget = {
  revenue: number
  grossProfit: number
  netProfit: number
  labourPct: number
  foodCostPct: number
}

export type BudgetPlan = {
  year: number
  annualRevenueTarget: number
  annualGrossProfitTarget: number
  annualNetProfitTarget: number
  annualFixedCostsTarget: number
  labourPctTarget: number
  foodCostPctTarget: number
  months: MonthlyBudget[]
}

export type BudgetRangeSummary = {
  revenue: number
  grossProfit: number
  netProfit: number
  labourPct: number
  foodCostPct: number
  annualRevenueTarget: number
  annualGrossProfitTarget: number
  annualNetProfitTarget: number
  annualFixedCostsTarget: number
  labourPctTarget: number
  foodCostPctTarget: number
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function storageKey(companyId: string, year: number) {
  return `mf_budget_forecast:${companyId}:${year}`
}

function emptyMonth(plan: BudgetPlan): MonthlyBudget {
  return {
    revenue: plan.annualRevenueTarget / 12,
    grossProfit: plan.annualGrossProfitTarget / 12,
    netProfit: plan.annualNetProfitTarget / 12,
    labourPct: plan.labourPctTarget,
    foodCostPct: plan.foodCostPctTarget,
  }
}

export function createDefaultBudgetPlan(year: number): BudgetPlan {
  const plan: BudgetPlan = {
    year,
    annualRevenueTarget: 0,
    annualGrossProfitTarget: 0,
    annualNetProfitTarget: 0,
    annualFixedCostsTarget: 0,
    labourPctTarget: 0.32,
    foodCostPctTarget: 0.28,
    months: [],
  }

  plan.months = Array.from({ length: 12 }, () => emptyMonth(plan))
  return plan
}

export function loadBudgetPlan(companyId: string, year: number): BudgetPlan | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(storageKey(companyId, year))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as BudgetPlan
    if (!parsed?.months?.length) return null
    return parsed
  } catch {
    return null
  }
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function overlapDays(rangeStart: Date, rangeEnd: Date, monthStart: Date, monthEnd: Date) {
  const start = Math.max(rangeStart.getTime(), monthStart.getTime())
  const end = Math.min(rangeEnd.getTime(), monthEnd.getTime())
  if (end < start) return 0
  return Math.floor((end - start) / 86400000) + 1
}

function clampMonthValue(value: number | undefined) {
  return Number.isFinite(value ?? NaN) ? Number(value) : 0
}

export function getBudgetRangeSummary(
  plan: BudgetPlan | null | undefined,
  startDate: Date,
  endDate: Date
): BudgetRangeSummary | null {
  if (!plan) return null

  const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

  let revenue = 0
  let grossProfit = 0
  let netProfit = 0
  let labourPctWeighted = 0
  let foodCostPctWeighted = 0
  let totalWeight = 0

  plan.months.forEach((month, index) => {
    const monthStart = new Date(plan.year, index, 1)
    const monthEnd = new Date(plan.year, index, daysInMonth(plan.year, index))
    const days = overlapDays(rangeStart, rangeEnd, monthStart, monthEnd)
    if (days <= 0) return

    const weight = days / daysInMonth(plan.year, index)
    revenue += clampMonthValue(month.revenue) * weight
    grossProfit += clampMonthValue(month.grossProfit) * weight
    netProfit += clampMonthValue(month.netProfit) * weight
    labourPctWeighted += clampMonthValue(month.labourPct) * days
    foodCostPctWeighted += clampMonthValue(month.foodCostPct) * days
    totalWeight += days
  })

  return {
    revenue,
    grossProfit,
    netProfit,
    labourPct: totalWeight > 0 ? labourPctWeighted / totalWeight : plan.labourPctTarget,
    foodCostPct: totalWeight > 0 ? foodCostPctWeighted / totalWeight : plan.foodCostPctTarget,
    annualRevenueTarget: plan.annualRevenueTarget,
    annualGrossProfitTarget: plan.annualGrossProfitTarget,
    annualNetProfitTarget: plan.annualNetProfitTarget,
    annualFixedCostsTarget: plan.annualFixedCostsTarget,
    labourPctTarget: plan.labourPctTarget,
    foodCostPctTarget: plan.foodCostPctTarget,
  }
}

export function getBudgetYearLabel(plan: BudgetPlan | null | undefined) {
  if (!plan) return "No budget plan"
  return `${plan.year} budget`
}

export function getBudgetMonthLabels() {
  return MONTH_NAMES
}
