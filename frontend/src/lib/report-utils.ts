type DateInput = string | Date

function parseDateInput(value: DateInput): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const dmyMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date()
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function formatDateInput(value: DateInput): string {
  const date = parseDateInput(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDateLong(value: DateInput): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateInput(value))
}

export function formatDateShort(value: DateInput): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
  }).format(parseDateInput(value))
}

export function getWeekStartMonday(dateInput: DateInput): Date {
  const date = parseDateInput(dateInput)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export function getWeekEndSunday(dateInput: DateInput): Date {
  const monday = getWeekStartMonday(dateInput)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(0, 0, 0, 0)
  return sunday
}

export function getISOWeek(dateInput: DateInput): number {
  const date = parseDateInput(dateInput)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getISOWeekYear(dateInput: DateInput): number {
  const date = parseDateInput(dateInput)
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  return tmp.getUTCFullYear()
}

export function getWeekInfo(dateInput: DateInput) {
  const start = getWeekStartMonday(dateInput)
  const end = getWeekEndSunday(dateInput)

  return {
    start,
    end,
    isoWeek: getISOWeek(end),
    isoYear: getISOWeekYear(end),
  }
}

export function getCurrentWeekEndingSunday() {
  return getWeekEndSunday(new Date())
}

export function getCurrentWeekEndingSundayInputValue() {
  return formatDateInput(getCurrentWeekEndingSunday())
}

export function normalizeWeekEndingToSunday(dateInput: DateInput) {
  return getWeekEndSunday(dateInput)
}

export function formatWeekRange(dateInput: DateInput): string {
  const { start, end } = getWeekInfo(dateInput)
  return `${formatDateLong(start)} \u2192 ${formatDateLong(end)}`
}

export function buildWeekLabel(dateInput: DateInput): string {
  const { start, end, isoWeek, isoYear } = getWeekInfo(dateInput)
  return `Week ${isoWeek} \u00B7 ${isoYear} \u00B7 ${formatDateLong(start)} \u2192 ${formatDateLong(end)}`
}
