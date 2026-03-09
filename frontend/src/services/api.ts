const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export type TenantBrief = {
  tenant_id: string
  name: string
  slug: string
  role: string
}

export type LoginResponse = {
  access_token: string
  tenants: TenantBrief[]
  refresh_token?: string
}

export type MeResponse = {
  user_id: string
  email: string
  full_name: string
  tenant_id: string | null
}

export type SelectTenantResponse = {
  access_token: string
  refresh_token?: string
}

export type Company = {
  id: string
  tenant_id: string
  name: string
  slug: string
  address?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  sales_source?: string | null
  square_location_id?: string | null
  zoho_org_id?: string | null
  integration_notes?: string | null
  created_at?: string
}

export type CompanyCreatePayload = {
  name: string
  slug: string
  address?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  sales_source?: string | null
  square_location_id?: string | null
  zoho_org_id?: string | null
  integration_notes?: string | null
}

export type CompanyUpdatePayload = {
  name: string
  slug: string
  address?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  sales_source?: string | null
  square_location_id?: string | null
  zoho_org_id?: string | null
  integration_notes?: string | null
}

export type DashboardWeek = {
  week_ending: string
  sales_inc_vat: number
  sales_ex_vat: number
  gross_profit: number
  gross_margin_pct: number
  net_profit: number
  net_margin_pct: number
}

export type DashboardData = {
  tenant_id: string
  company_id: string
  weeks: number
  total_sales_ex_vat: number
  total_sales_inc_vat: number
  total_wages: number
  total_food_cost: number
  total_fixed_costs: number
  total_variable_costs: number
  total_loans_hp: number
  total_vat_due: number
  total_gross_profit: number
  total_net_profit: number
  avg_gross_margin_pct: number
  avg_net_margin_pct: number
  last_weeks: DashboardWeek[]
}

export type PortfolioCompany = {
  company_id: string
  company_name: string
  weeks: number
  sales_ex_vat: number
  sales_inc_vat: number
  gross_profit: number
  net_profit: number
  gross_margin_pct: number
  net_margin_pct: number
}

export type PortfolioData = {
  tenant_id: string
  weeks: number
  total_sales_ex_vat: number
  total_sales_inc_vat: number
  total_gross_profit: number
  total_net_profit: number
  companies: PortfolioCompany[]
}

export type WeeklyReportCreatePayload = {
  company_id: string
  week_ending: string
  sales_inc_vat: number
  sales_ex_vat: number
  wages: number
  holiday_pay: number
  food_cost: number
  fixed_costs: number
  variable_costs: number
  loans_hp: number
  vat_due: number
  notes?: string
}

export type WeeklyReportResponse = {
  id: string
  tenant_id: string
  company_id: string
  week_ending: string
  sales_inc_vat: number
  sales_ex_vat: number
  wages: number
  holiday_pay: number
  food_cost: number
  fixed_costs: number
  variable_costs: number
  loans_hp: number
  vat_due: number
  notes?: string | null
  created_at?: string
}

const ACCESS_TOKEN_KEY = "marginflow_access_token"
const REFRESH_TOKEN_KEY = "marginflow_refresh_token"
const ACTIVE_TENANT_KEY = "mf_tenant_id"

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_TENANT_KEY)
}

export function setActiveTenantId(tenantId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
}

export function clearActiveTenantId() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACTIVE_TENANT_KEY)
}

function clearAuthState() {
  clearAccessToken()
  clearRefreshToken()
  clearActiveTenantId()
}

async function rawFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await rawFetch("/auth/refresh", {
    method: "POST",
  })

  if (!res.ok) {
    clearAuthState()
    return null
  }

  const data = (await res.json()) as SelectTenantResponse
  setAccessToken(data.access_token)

  if (data.refresh_token) {
    setRefreshToken(data.refresh_token)
  }

  const tenantId = getActiveTenantId()
  if (!tenantId) {
    return data.access_token
  }

  const selectRes = await rawFetch("/auth/select-tenant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
    body: JSON.stringify({ tenant_id: tenantId }),
  })

  if (!selectRes.ok) {
    clearAuthState()
    return null
  }

  const selected = (await selectRes.json()) as SelectTenantResponse
  setAccessToken(selected.access_token)

  if (selected.refresh_token) {
    setRefreshToken(selected.refresh_token)
  }

  return selected.access_token
}

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let token = getAccessToken()
  const tenantId = getActiveTenantId()

  const makeRequest = async (bearer: string | null) => {
    return fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
        ...(options?.headers || {}),
      },
    })
  }

  let res = await makeRequest(token)

  if (res.status === 401) {
    const refreshedToken = await refreshAccessToken()
    if (!refreshedToken) {
      throw new Error('API error 401: {"detail":"Missing bearer token"}')
    }

    token = refreshedToken
    res = await makeRequest(token)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await rawFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim(),
      password: password.trim(),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }

  const data = (await res.json()) as LoginResponse

  setAccessToken(data.access_token)

  if (data.refresh_token) {
    setRefreshToken(data.refresh_token)
  }

  return data
}

export async function selectTenant(
  tenantId: string
): Promise<SelectTenantResponse> {
  const token = getAccessToken()

  if (!token) {
    throw new Error("No access token found.")
  }

  const res = await rawFetch("/auth/select-tenant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }

  const data = (await res.json()) as SelectTenantResponse

  setAccessToken(data.access_token)

  if (data.refresh_token) {
    setRefreshToken(data.refresh_token)
  }

  setActiveTenantId(tenantId)

  return data
}

export async function getMe(): Promise<MeResponse> {
  return authFetch<MeResponse>("/auth/me", {
    method: "GET",
  })
}

export function logout() {
  clearAuthState()
  window.location.href = "/login"
}

export async function getDashboard(companyId: string): Promise<DashboardData> {
  return authFetch<DashboardData>(
    `/api/dashboard/?company_id=${companyId}&weeks=4`
  )
}

export async function getPortfolioDashboard(): Promise<PortfolioData> {
  return authFetch<PortfolioData>(`/api/dashboard/portfolio?weeks=4`)
}

export async function getCompanies(): Promise<Company[]> {
  return authFetch<Company[]>("/api/companies/")
}

export async function getCompanyById(companyId: string): Promise<Company> {
  return authFetch<Company>(`/api/companies/${companyId}`)
}

export async function createCompany(
  payload: CompanyCreatePayload
): Promise<Company> {
  return authFetch<Company>("/api/companies/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateCompany(
  companyId: string,
  payload: CompanyUpdatePayload
): Promise<Company> {
  return authFetch<Company>(`/api/companies/${companyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteCompany(
  companyId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(`/api/companies/${companyId}`, {
    method: "DELETE",
  })
}

export async function createWeeklyReport(
  payload: WeeklyReportCreatePayload
): Promise<WeeklyReportResponse> {
  return authFetch<WeeklyReportResponse>("/api/weekly-reports/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}