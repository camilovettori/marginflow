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

export type PurchaseInvoiceLinePayload = {
  ingredient_name: string
  ingredient_sku?: string | null
  category?: string | null
  quantity_purchased: number
  purchase_unit: string
  pack_size_value?: number | null
  pack_size_unit?: string | null
  net_quantity_for_costing: number
  costing_unit: string
  line_total_ex_vat: number
  vat_rate: number
  line_total_inc_vat?: number | null
  brand?: string | null
  supplier_product_name?: string | null
}

export type PurchaseInvoiceCreatePayload = {
  supplier_name: string
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  currency?: string
  notes?: string | null
  attachment_name?: string | null
  vat_included?: boolean
  subtotal_ex_vat?: number | null
  vat_total?: number | null
  total_inc_vat?: number | null
  status: "draft" | "posted"
  lines: PurchaseInvoiceLinePayload[]
}

export type PurchaseInvoiceUpdatePayload = PurchaseInvoiceCreatePayload

export type PurchaseInvoiceLine = {
  id: string
  ingredient_id?: string | null
  line_order: number
  ingredient_name: string
  ingredient_sku?: string | null
  category?: string | null
  quantity_purchased: number
  purchase_unit: string
  pack_size_value?: number | null
  pack_size_unit?: string | null
  net_quantity_for_costing: number
  costing_unit: string
  line_total_ex_vat: number
  vat_rate: number
  vat_amount: number
  line_total_inc_vat: number
  normalized_unit_cost_ex_vat: number
  normalized_unit_cost_inc_vat: number
  brand?: string | null
  supplier_product_name?: string | null
}

export type PurchaseInvoice = {
  id: string
  tenant_id: string
  company_id: string
  supplier_name: string
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  currency: string
  notes?: string | null
  attachment_name?: string | null
  vat_included: boolean
  subtotal_ex_vat: number
  vat_total: number
  total_inc_vat: number
  status: "draft" | "posted"
  created_at?: string | null
  updated_at?: string | null
  lines: PurchaseInvoiceLine[]
}

export type PurchaseInvoiceListResponse = {
  company_id: string
  total_invoices: number
  posted_invoices: number
  draft_invoices: number
  total_spend_ex_vat: number
  total_spend_inc_vat: number
  invoices: PurchaseInvoice[]
}

export type PdfExtractedLine = {
  ingredient_name: string
  supplier_product_name: string
  ingredient_sku: string | null
  quantity_purchased: number | null
  purchase_unit: string
  pack_size_value: number | null
  pack_size_unit: string | null
  net_quantity_for_costing: number | null
  costing_unit: string
  unit_price_ex_vat: number | null
  line_total_ex_vat: number | null
  vat_rate: number | null
  line_total_inc_vat: number | null
  brand: string | null
  category: string | null
}

export type PdfExtractResponse = {
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  currency: string | null
  subtotal_ex_vat: number | null
  vat_total: number | null
  total_inc_vat: number | null
  notes: string | null
  vat_included: boolean
  lines: PdfExtractedLine[]
  warnings: string[]
  extraction_debug: string | null
}

export type IngredientUpdatePayload = {
  name: string
  default_unit_for_costing: string
  category?: string | null
  notes?: string | null
  is_active: boolean
}

export type Ingredient = {
  id: string
  tenant_id: string
  company_id: string
  name: string
  normalized_name: string
  default_unit_for_costing: string
  category?: string | null
  latest_unit_cost_ex_vat?: number | null
  latest_unit_cost_inc_vat?: number | null
  latest_purchase_date?: string | null
  latest_supplier_name?: string | null
  notes?: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  purchase_count: number
}

export type IngredientPurchaseHistoryItem = {
  line_id: string
  invoice_id: string
  invoice_number: string
  invoice_date: string
  supplier_name: string
  quantity_purchased: number
  purchase_unit: string
  net_quantity_for_costing: number
  costing_unit: string
  line_total_ex_vat: number
  line_total_inc_vat: number
  normalized_unit_cost_ex_vat: number
  normalized_unit_cost_inc_vat: number
  brand?: string | null
  supplier_product_name?: string | null
}

export type IngredientListResponse = {
  company_id: string
  total_ingredients: number
  active_ingredients: number
  inactive_ingredients: number
  missing_price_ingredients: number
  ingredients: Ingredient[]
}

export type IngredientDetailResponse = {
  ingredient: Ingredient
  recent_purchases: IngredientPurchaseHistoryItem[]
}

export type RecipeIngredientPayload = {
  ingredient_id: string
  quantity_required: number
  unit_used: string
}

export type RecipeCreatePayload = {
  recipe_name: string
  photo_url?: string | null
  category?: string | null
  description?: string | null
  notes?: string | null
  yield_quantity: number
  yield_unit: string
  portion_size?: number | null
  wastage_percent?: number
  labour_cost_override?: number | null
  packaging_cost_override?: number | null
  target_food_cost_percent?: number | null
  selling_price_ex_vat?: number | null
  selling_price_inc_vat?: number | null
  is_active?: boolean
  ingredients: RecipeIngredientPayload[]
}

export type RecipeUpdatePayload = RecipeCreatePayload

export type RecipeDuplicatePayload = {
  recipe_name?: string | null
}

export type RecipePhotoUploadResponse = {
  photo_url: string
}

export type RecipeIngredient = {
  id: string
  ingredient_id?: string | null
  ingredient_name: string
  ingredient_default_unit_for_costing: string
  line_order: number
  quantity_required: number
  unit_used: string
  normalized_quantity?: number | null
  latest_unit_cost_ex_vat?: number | null
  latest_unit_cost_inc_vat?: number | null
  normalized_unit_cost_ex_vat?: number | null
  normalized_unit_cost_inc_vat?: number | null
  line_cost_ex_vat?: number | null
  line_cost_inc_vat?: number | null
  missing_price: boolean
  unit_mismatch: boolean
  source_purchase_date?: string | null
  source_supplier_name?: string | null
}

export type RecipeSummary = {
  id: string
  tenant_id: string
  company_id: string
  recipe_name: string
  normalized_name: string
  photo_url?: string | null
  category?: string | null
  description?: string | null
  notes?: string | null
  yield_quantity: number
  yield_unit: string
  portion_size?: number | null
  wastage_percent: number
  labour_cost_override?: number | null
  packaging_cost_override?: number | null
  target_food_cost_percent?: number | null
  selling_price_ex_vat?: number | null
  selling_price_inc_vat?: number | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  ingredient_count: number
  missing_ingredient_count: number
  total_recipe_cost_ex_vat?: number | null
  total_recipe_cost_inc_vat?: number | null
  cost_per_yield_ex_vat?: number | null
  cost_per_yield_inc_vat?: number | null
  cost_per_portion_ex_vat?: number | null
  cost_per_portion_inc_vat?: number | null
  gross_margin_value_ex_vat?: number | null
  gross_margin_percent_ex_vat?: number | null
  markup_percent?: number | null
  food_cost_percent?: number | null
  has_missing_costs: boolean
}

export type RecipeDetailResponse = {
  recipe: RecipeSummary
  ingredients: RecipeIngredient[]
  warnings: string[]
}

export type RecipeListResponse = {
  company_id: string
  total_recipes: number
  active_recipes: number
  inactive_recipes: number
  missing_cost_recipes: number
  highest_cost_recipe_id?: string | null
  highest_cost_recipe_name?: string | null
  highest_cost_recipe_cost_ex_vat?: number | null
  recipes: RecipeSummary[]
}

export type ZohoSyncResponse = {
  success: boolean
  company_id: string
  preset?: string
  week_ending?: string | null
  date_from?: string | null
  date_to?: string | null
  weeks_detected: number
  invoices_synced?: number
  line_items_synced?: number
  created_reports: number
  updated_reports?: number
  skipped_existing_reports: number
}

export type UnifyZohoSyncResponse = {
  success: boolean
  company_id: string
  products_loaded: number
  orders_fetched: number
  buyer_groups: number
  invoices_created: number
  duplicates_skipped: number
  contacts_created: number
  contacts_reused: number
  items_created: number
  items_reused: number
  line_items_created: number
  logs: string[]
}

export type ZohoWeeklyPrefillResponse = {
  success: boolean
  company_id: string
  company_name: string
  week_ending: string
  source: string
  found: boolean
  sales_inc_vat: number
  sales_ex_vat: number
  notes?: string | null
}

export type SalesConnectionState = {
  connected: boolean
  zoho_org_id?: string | null
  connected_email?: string | null
  last_sync_at?: string | null
  sales_source?: string | null
}

export type SalesTrendPoint = {
  period: string
  sales_inc_vat: number
  sales_ex_vat: number
  invoice_count: number
}

export type SalesCustomerItemBreakdown = {
  item_id?: string | null
  item_name: string
  quantity: number
  revenue_ex_vat: number
  revenue_inc_vat: number
  invoice_count: number
}

export type SalesCustomerRow = {
  rank: number
  customer_id?: string | null
  customer_name: string
  total_spend_inc_vat: number
  total_spend_ex_vat: number
  invoice_count: number
  average_order_value: number
  last_purchase_date?: string | null
  items: SalesCustomerItemBreakdown[]
}

export type SalesItemRow = {
  rank: number
  item_id?: string | null
  item_name: string
  quantity_sold: number
  revenue_ex_vat: number
  revenue_inc_vat: number
  invoice_count: number
}

export type SalesInvoiceRow = {
  invoice_date: string
  invoice_number?: string | null
  customer_name?: string | null
  total_ex_vat: number
  total_inc_vat: number
  status?: string | null
}

export type SalesAnalyticsResponse = {
  company_id: string
  company_name: string
  range_key: string
  range_label: string
  start_date: string
  end_date: string
  connection: SalesConnectionState
  total_sales_inc_vat: number
  total_sales_ex_vat: number
  vat_collected: number
  invoice_count: number
  active_customers: number
  average_order_value: number
  top_customers: SalesCustomerRow[]
  customer_breakdown?: SalesCustomerRow | null
  top_items: SalesItemRow[]
  invoice_trend: SalesTrendPoint[]
  recent_invoices: SalesInvoiceRow[]
}

export type AnalyticsPeriodKey =
  | "last-week"
  | "last-4-weeks"
  | "last-3-months"
  | "last-6-months"
  | "last-12-months"
  | "specific-range"

export type AnalyticsPeriod = {
  key: AnalyticsPeriodKey
  label: string
  granularity: "day" | "week" | "month"
  start_date: string
  end_date: string
  comparison_start_date: string
  comparison_end_date: string
  comparison_label: string
  total_days: number
}

export type AnalyticsMetric = {
  key: string
  label: string
  value?: number | null
  previous_value?: number | null
  delta?: number | null
  delta_pct?: number | null
  unit: "currency" | "percent" | "count" | "ratio"
  source?: string | null
  available: boolean
}

export type AnalyticsSummary = {
  weekly_report_count: number
  sales_invoice_count: number
  sales_item_count: number
  purchase_invoice_count: number
  purchase_line_count: number
  matched_product_count: number
  revenue_ex_vat?: number | null
  revenue_inc_vat?: number | null
  ledger_revenue_ex_vat?: number | null
  ledger_revenue_inc_vat?: number | null
  gross_profit?: number | null
  net_profit?: number | null
  gross_margin_pct?: number | null
  net_margin_pct?: number | null
  labour_total?: number | null
  labour_pct?: number | null
  food_cost?: number | null
  food_cost_pct?: number | null
  fixed_costs?: number | null
  variable_costs?: number | null
  loans_hp?: number | null
  vat_due?: number | null
  average_weekly_revenue?: number | null
  average_weekly_profit?: number | null
  average_order_value?: number | null
  active_customers: number
  annualized_revenue_ex_vat?: number | null
  annualized_gross_profit?: number | null
  annualized_net_profit?: number | null
  annualized_gross_margin_pct?: number | null
  annualized_net_margin_pct?: number | null
}

export type AnalyticsTrendPoint = {
  period: string
  label: string
  revenue_ex_vat: number
  revenue_inc_vat: number
  gross_profit?: number | null
  net_profit?: number | null
  gross_margin_pct?: number | null
  net_margin_pct?: number | null
  labour_pct?: number | null
  food_cost_pct?: number | null
  invoice_count?: number | null
}

export type AnalyticsHighlight = {
  key: string
  kind: "day" | "week" | "month"
  direction: "best" | "worst"
  label: string
  start_date: string
  end_date: string
  revenue_ex_vat: number
  gross_profit?: number | null
  net_profit?: number | null
  gross_margin_pct?: number | null
  net_margin_pct?: number | null
}

export type AnalyticsProductRow = {
  rank: number
  item_id?: string | null
  item_name: string
  quantity_sold: number
  revenue_ex_vat: number
  revenue_share: number
  invoice_count: number
  matched_recipe_id?: string | null
  matched_recipe_name?: string | null
  matched_category?: string | null
  estimated_recipe_margin_pct?: number | null
  estimated_recipe_gross_profit?: number | null
  estimated_recipe_food_cost_pct?: number | null
}

export type AnalyticsCategoryRow = {
  rank: number
  label: string
  value: number
  share: number
  item_count?: number | null
  source: string
}

export type AnalyticsInsight = {
  key: string
  severity: "info" | "success" | "warning" | "critical"
  title: string
  summary: string
  why_it_matters: string
  recommended_action: string
  evidence: string[]
}

export type AnalyticsCoverage = {
  weekly_reports: number
  sales_invoices: number
  sales_items: number
  purchase_invoices: number
  purchase_lines: number
  recipes: number
  matched_products: number
}

export type CompanyAnalyticsResponse = {
  company_id: string
  company_name: string
  period: AnalyticsPeriod
  summary: AnalyticsSummary
  kpis: AnalyticsMetric[]
  sales_trend: AnalyticsTrendPoint[]
  weekly_trend: AnalyticsTrendPoint[]
  highlights: AnalyticsHighlight[]
  top_products: AnalyticsProductRow[]
  top_revenue_categories: AnalyticsCategoryRow[]
  top_cost_categories: AnalyticsCategoryRow[]
  top_suppliers: AnalyticsCategoryRow[]
  insights: AnalyticsInsight[]
  coverage: AnalyticsCoverage
}

export function getZohoConnectUrl(companyId: string): string {
  const tenantId =
    typeof window !== "undefined" ? localStorage.getItem("mf_tenant_id") : null

  if (!tenantId) {
    throw new Error("No active tenant selected.")
  }

  return `${API_URL}/api/integrations/zoho/connect/${companyId}?tenant_id=${tenantId}`
}

export async function disconnectZohoConnection(companyId: string): Promise<{ success: boolean; company_id: string; connected: boolean }> {
  const tenantId = getActiveTenantId()
  if (!tenantId) {
    throw new Error("No active tenant selected.")
  }

  return authFetch<{ success: boolean; company_id: string; connected: boolean }>(
    `/api/integrations/zoho/disconnect/${companyId}?tenant_id=${tenantId}`,
    {
      method: "DELETE",
    }
  )
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

export type WeeklyReportsBulkDeleteResponse = {
  success: boolean
  deleted_count: number
  deleted_report_ids: string[]
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

export type WeeklyReportUpdatePayload = {
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

  company_name?: string | null

  week_ending: string
  week_start?: string | null
  week_end?: string | null
  iso_week?: number | null
  iso_year?: number | null

  sales_inc_vat: number
  sales_ex_vat: number
  wages: number
  holiday_pay: number
  food_cost: number
  fixed_costs: number
  variable_costs: number
  loans_hp: number
  vat_due: number

  gross_profit?: number | null
  gross_margin_pct?: number | null
  net_profit?: number | null
  net_margin_pct?: number | null
  labour_pct?: number | null

  source?: string | null
  notes?: string | null

  insights?: string[]
  recommendations?: string[]

  created_at?: string
  updated_at?: string
}

export type WeeklyReportListItem = WeeklyReportResponse

export type WeeklyReportDetail = WeeklyReportResponse

export type WeeklyReportsSummary = {
  total_reports: number
  imported_reports: number
  manual_reports: number
  total_sales_inc_vat: number
  total_sales_ex_vat: number
  total_wages: number
  total_net_profit: number
}

export type WeeklyReportPdfResponse = {
  download_url: string
  report: WeeklyReportDetail
}

export type WeeklyReportEmailResponse = {
  success: boolean
  message?: string | null
}

export type TenantMember = {
  user_id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
}

export type TenantMemberCreatePayload = {
  email: string
  full_name?: string | null
  role: string
}

export type TenantMemberCreateResponse = {
  user_id: string
  email: string
  temporary_password: string | null
}

export type TenantMemberRoleUpdatePayload = {
  role: string
}

export type FinancialCategory = {
  id: string
  tenant_id: string
  name: string
  type: string
  group?: string | null
  is_active: boolean
  created_at?: string
}

export type FinancialCategoryCreatePayload = {
  name: string
  type: string
  group?: string | null
  is_active?: boolean
}

export type FinancialCategoryUpdatePayload = {
  name: string
  type: string
  group?: string | null
  is_active: boolean
}

export type WeeklyReportItem = {
  id: string
  tenant_id: string
  company_id: string
  weekly_report_id: string
  category_id: string
  amount: number
  notes?: string | null
  created_at?: string
}

export type WeeklyReportItemCreatePayload = {
  category_id: string
  amount: number
  notes?: string | null
}

export type WeeklyReportItemUpdatePayload = {
  category_id: string
  amount: number
  notes?: string | null
}

export type WeeklyReportBreakdownItem = {
  id: string
  category_id: string
  category_name: string
  category_type: string
  category_group?: string | null
  amount: number
  notes?: string | null
}

export type WeeklyReportBreakdownGroupTotal = {
  key: string
  total: number
}

export type WeeklyReportBreakdownResponse = {
  report: WeeklyReportDetail
  items: WeeklyReportBreakdownItem[]
  totals_by_type: WeeklyReportBreakdownGroupTotal[]
  totals_by_group: WeeklyReportBreakdownGroupTotal[]
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
    try {
      return await fetch(`${API_URL}${path}`, {
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
    } catch {
      throw new Error(
        `Unable to reach the server while requesting ${path}. Check if the backend is running or if CORS is configured correctly.`
      )
    }
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

async function authFetchFormData<T>(path: string, formData: FormData): Promise<T> {
  let token = getAccessToken()
  const tenantId = getActiveTenantId()

  const makeRequest = async (bearer: string | null) => {
    try {
      return await fetch(`${API_URL}${path}`, {
        method: "POST",
        body: formData,
        credentials: "include",
        cache: "no-store",
        // No Content-Type header — browser sets it automatically for FormData (includes boundary)
        headers: {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
        },
      })
    } catch {
      throw new Error(
        `Unable to reach the server while requesting ${path}. Check if the backend is running.`
      )
    }
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

export async function getDashboard(
  companyId: string,
  weeks: number = 4
): Promise<DashboardData> {
  return authFetch<DashboardData>(
    `/api/dashboard/?company_id=${companyId}&weeks=${weeks}`
  )
}

export async function getPortfolioDashboard(): Promise<PortfolioData> {
  return authFetch<PortfolioData>(`/api/dashboard/portfolio?weeks=4`)
}

export async function getSalesAnalytics(
  companyId: string,
  range: "week" | "4w" | "3m" | "6m" | "12m" = "4w",
  customerId?: string | null
): Promise<SalesAnalyticsResponse> {
  const params = new URLSearchParams()
  params.set("range", range)
  if (customerId) params.set("customer_id", customerId)
  return authFetch<SalesAnalyticsResponse>(`/api/sales/${companyId}?${params.toString()}`)
}

export async function getCompanyAnalytics(
  companyId: string,
  params: {
    period: AnalyticsPeriodKey
    startDate?: string | null
    endDate?: string | null
  }
): Promise<CompanyAnalyticsResponse> {
  const query = new URLSearchParams()
  query.set("period", params.period)
  if (params.startDate) query.set("start_date", params.startDate)
  if (params.endDate) query.set("end_date", params.endDate)

  return authFetch<CompanyAnalyticsResponse>(`/api/analytics/${companyId}?${query.toString()}`)
}

export async function getCompanies(): Promise<Company[]> {
  return authFetch<Company[]>("/api/companies/")
}

export async function getCompanyById(companyId: string): Promise<Company> {
  return authFetch<Company>(`/api/companies/${companyId}`)
}

export async function getCompanyPurchaseInvoices(
  companyId: string
): Promise<PurchaseInvoiceListResponse> {
  return authFetch<PurchaseInvoiceListResponse>(`/api/costing/${companyId}/purchase-invoices`, {
    method: "GET",
  })
}

export async function createCompanyPurchaseInvoice(
  companyId: string,
  payload: PurchaseInvoiceCreatePayload
): Promise<PurchaseInvoice> {
  return authFetch<PurchaseInvoice>(`/api/costing/${companyId}/purchase-invoices`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateCompanyPurchaseInvoice(
  invoiceId: string,
  payload: PurchaseInvoiceUpdatePayload
): Promise<PurchaseInvoice> {
  return authFetch<PurchaseInvoice>(`/api/costing/purchase-invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteCompanyPurchaseInvoice(
  invoiceId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(`/api/costing/purchase-invoices/${invoiceId}`, {
    method: "DELETE",
  })
}

export async function uploadCompanyPurchaseInvoicePdf(
  companyId: string,
  file: File
): Promise<PdfExtractResponse> {
  const formData = new FormData()
  formData.append("file", file)
  return authFetchFormData<PdfExtractResponse>(
    `/api/costing/${companyId}/purchase-invoices/upload`,
    formData
  )
}

export async function getCompanyIngredients(
  companyId: string,
  options?: {
    search?: string
    view?: "all" | "active" | "inactive"
  }
): Promise<IngredientListResponse> {
  const params = new URLSearchParams()
  if (options?.search) params.set("search", options.search)
  if (options?.view) params.set("view", options.view)
  const query = params.toString()
  return authFetch<IngredientListResponse>(
    query ? `/api/costing/${companyId}/ingredients?${query}` : `/api/costing/${companyId}/ingredients`,
    {
      method: "GET",
    }
  )
}

export async function getIngredientDetail(
  ingredientId: string
): Promise<IngredientDetailResponse> {
  return authFetch<IngredientDetailResponse>(`/api/costing/ingredients/${ingredientId}`, {
    method: "GET",
  })
}

export async function updateIngredient(
  ingredientId: string,
  payload: IngredientUpdatePayload
): Promise<Ingredient> {
  return authFetch<Ingredient>(`/api/costing/ingredients/${ingredientId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function archiveIngredient(
  ingredientId: string
): Promise<Ingredient> {
  return authFetch<Ingredient>(`/api/costing/ingredients/${ingredientId}`, {
    method: "DELETE",
  })
}

export async function getCompanyRecipes(companyId: string): Promise<RecipeListResponse> {
  return authFetch<RecipeListResponse>(`/api/costing/${companyId}/recipes`, {
    method: "GET",
  })
}

export async function createCompanyRecipe(
  companyId: string,
  payload: RecipeCreatePayload
): Promise<RecipeDetailResponse> {
  return authFetch<RecipeDetailResponse>(`/api/costing/${companyId}/recipes`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function uploadRecipePhoto(
  companyId: string,
  file: File
): Promise<RecipePhotoUploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  return authFetchFormData<RecipePhotoUploadResponse>(
    `/api/costing/${companyId}/recipes/photo`,
    formData
  )
}

export async function getRecipeDetail(recipeId: string): Promise<RecipeDetailResponse> {
  return authFetch<RecipeDetailResponse>(`/api/costing/recipes/${recipeId}`, {
    method: "GET",
  })
}

export async function updateRecipe(
  recipeId: string,
  payload: RecipeUpdatePayload
): Promise<RecipeDetailResponse> {
  return authFetch<RecipeDetailResponse>(`/api/costing/recipes/${recipeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function duplicateRecipe(
  recipeId: string,
  payload?: RecipeDuplicatePayload | null
): Promise<RecipeDetailResponse> {
  return authFetch<RecipeDetailResponse>(`/api/costing/recipes/${recipeId}/duplicate`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  })
}

export async function deleteRecipe(
  recipeId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(`/api/costing/recipes/${recipeId}`, {
    method: "DELETE",
  })
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

export async function getWeeklyReports(
  companyId: string
): Promise<WeeklyReportListItem[]> {
  return authFetch<WeeklyReportListItem[]>(
    `/api/weekly-reports/?company_id=${companyId}`,
    {
      method: "GET",
    }
  )
}

export async function getWeeklyReportsSummary(
  companyId: string
): Promise<WeeklyReportsSummary> {
  return authFetch<WeeklyReportsSummary>(
    `/api/weekly-reports/summary?company_id=${companyId}`,
    {
      method: "GET",
    }
  )
}

export async function getWeeklyReportById(
  reportId: string
): Promise<WeeklyReportDetail> {
  return authFetch<WeeklyReportDetail>(`/api/weekly-reports/${reportId}`, {
    method: "GET",
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

export async function updateWeeklyReport(
  reportId: string,
  payload: WeeklyReportUpdatePayload
): Promise<WeeklyReportDetail> {
  return authFetch<WeeklyReportDetail>(`/api/weekly-reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteWeeklyReportsBulk(
  reportIds: string[]
): Promise<WeeklyReportsBulkDeleteResponse> {
  return authFetch<WeeklyReportsBulkDeleteResponse>("/api/weekly-reports/bulk", {
    method: "DELETE",
    body: JSON.stringify({
      report_ids: reportIds,
    }),
  })
}

export async function generateWeeklyReportPdf(
  reportId: string
): Promise<WeeklyReportPdfResponse> {
  return authFetch<WeeklyReportPdfResponse>(
    `/api/weekly-reports/${reportId}/generate-pdf`,
    {
      method: "POST",
    }
  )
}

export async function sendWeeklyReportEmail(
  reportId: string
): Promise<WeeklyReportEmailResponse> {
  return authFetch<WeeklyReportEmailResponse>(
    `/api/weekly-reports/${reportId}/send-email`,
    {
      method: "POST",
    }
  )
}

export async function syncZohoSales(
  companyId: string,
  options?: {
    preset?: "this_week" | "last_week" | "last_4_weeks" | "last_12_weeks" | "specific_week"
    weekEnding?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<ZohoSyncResponse> {
  const params = new URLSearchParams()

  if (options?.preset) {
    params.set("preset", options.preset)
  }

  if (options?.weekEnding) {
    params.set("week_ending", options.weekEnding)
  }

  if (options?.dateFrom) {
    params.set("date_from", options.dateFrom)
  }

  if (options?.dateTo) {
    params.set("date_to", options.dateTo)
  }

  const query = params.toString()
  const url = query
    ? `/api/integrations/zoho/sync/${companyId}?${query}`
    : `/api/integrations/zoho/sync/${companyId}`

  return authFetch<ZohoSyncResponse>(url, {
    method: "POST",
  })
}

export async function syncUnifyZohoSales(
  companyId: string
): Promise<UnifyZohoSyncResponse> {
  return authFetch<UnifyZohoSyncResponse>(`/api/integrations/unify/sync/${companyId}`, {
    method: "POST",
  })
}

export async function getZohoWeeklyPrefill(
  companyId: string,
  weekEnding: string
): Promise<ZohoWeeklyPrefillResponse> {
  return authFetch<ZohoWeeklyPrefillResponse>(
    `/api/integrations/zoho/prefill/${companyId}?week_ending=${weekEnding}`,
    {
      method: "GET",
    }
  )
}

export async function getTenantMembers(
  tenantId: string
): Promise<TenantMember[]> {
  return authFetch<TenantMember[]>(`/api/tenants/${tenantId}/members`, {
    method: "GET",
  })
}

export async function createTenantMember(
  tenantId: string,
  payload: TenantMemberCreatePayload
): Promise<TenantMemberCreateResponse> {
  return authFetch<TenantMemberCreateResponse>(
    `/api/tenants/${tenantId}/members`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )
}

export async function updateTenantMemberRole(
  tenantId: string,
  userId: string,
  payload: TenantMemberRoleUpdatePayload
): Promise<TenantMember> {
  return authFetch<TenantMember>(
    `/api/tenants/${tenantId}/members/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  )
}

export async function removeTenantMember(
  tenantId: string,
  userId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(
    `/api/tenants/${tenantId}/members/${userId}`,
    {
      method: "DELETE",
    }
  )
}

export type RegisterResponse = {
  access_token: string
  tenants: TenantBrief[]
  refresh_token?: string
}

export async function registerUser(payload: {
  full_name: string
  email: string
  password: string
  workspace_name?: string
}): Promise<RegisterResponse> {
  const res = await rawFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Register failed (${res.status})`)
  }

  return res.json() as Promise<RegisterResponse>
}

export async function getFinancialCategories(): Promise<FinancialCategory[]> {
  return authFetch<FinancialCategory[]>("/api/financial-categories/", {
    method: "GET",
  })
}

export async function getFinancialCategoryById(
  categoryId: string
): Promise<FinancialCategory> {
  return authFetch<FinancialCategory>(`/api/financial-categories/${categoryId}`, {
    method: "GET",
  })
}

export async function createFinancialCategory(
  payload: FinancialCategoryCreatePayload
): Promise<FinancialCategory> {
  return authFetch<FinancialCategory>("/api/financial-categories/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateFinancialCategory(
  categoryId: string,
  payload: FinancialCategoryUpdatePayload
): Promise<FinancialCategory> {
  return authFetch<FinancialCategory>(`/api/financial-categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteFinancialCategory(
  categoryId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(`/api/financial-categories/${categoryId}`, {
    method: "DELETE",
  })
}

export async function getWeeklyReportItems(
  weeklyReportId: string
): Promise<WeeklyReportItem[]> {
  return authFetch<WeeklyReportItem[]>(`/api/weekly-report-items/report/${weeklyReportId}`, {
    method: "GET",
  })
}

export async function createWeeklyReportItem(
  weeklyReportId: string,
  payload: WeeklyReportItemCreatePayload
): Promise<WeeklyReportItem> {
  return authFetch<WeeklyReportItem>(`/api/weekly-report-items/report/${weeklyReportId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateWeeklyReportItem(
  itemId: string,
  payload: WeeklyReportItemUpdatePayload
): Promise<WeeklyReportItem> {
  return authFetch<WeeklyReportItem>(`/api/weekly-report-items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteWeeklyReportItem(
  itemId: string
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(`/api/weekly-report-items/${itemId}`, {
    method: "DELETE",
  })
}

export async function getWeeklyReportBreakdown(
  weeklyReportId: string
): Promise<WeeklyReportBreakdownResponse> {
  return authFetch<WeeklyReportBreakdownResponse>(
    `/api/weekly-reports/${weeklyReportId}/breakdown`,
    {
      method: "GET",
    }
  )
}
