export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatPercent(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  return `${(n * 100).toFixed(1)}%`
}

export function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatDateDDMMYYYY(dateInput: string | Date): string {
  const d = new Date(dateInput)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export function formatDateShort(dateInput: string | Date): string {
  const d = new Date(dateInput)
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

export function getISOWeek(dateInput: string | Date): number {
  const date = new Date(dateInput)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getISOWeekYear(dateInput: string | Date): number {
  const date = new Date(dateInput)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  return tmp.getUTCFullYear()
}

export function getWeekStartMonday(dateInput: string | Date): Date {
  const date = new Date(dateInput)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export function getWeekEndSunday(dateInput: string | Date): Date {
  const monday = getWeekStartMonday(dateInput)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

export function buildWeekLabel(dateInput: string | Date): string {
  const isoWeek = getISOWeek(dateInput)
  const start = getWeekStartMonday(dateInput)
  const end = getWeekEndSunday(dateInput)

  const startStr = new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
  }).format(start)

  const endStr = new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end)

  return `ISO ${isoWeek} • ${startStr} → ${endStr}`
}