import { expect, test } from "playwright/test"

const companyId = "673974b4-d367-411c-b473-e3bdcd5aaaf5"
const analyticsUrl = `http://localhost:3000/companies/${companyId}/analytics`

test("analytics page loads live data and refreshes on period change", async ({ page }) => {
  const token = process.env.MARGINFLOW_ACCESS_TOKEN
  const tenantId = process.env.MARGINFLOW_TENANT_ID

  if (!token || !tenantId) {
    throw new Error("Missing MARGINFLOW_ACCESS_TOKEN or MARGINFLOW_TENANT_ID.")
  }

  await page.addInitScript(
    ({ tokenValue, tenantValue }) => {
      localStorage.setItem("marginflow_access_token", tokenValue)
      localStorage.setItem("mf_tenant_id", tenantValue)
    },
    { tokenValue: token, tenantValue: tenantId }
  )

  const firstResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/analytics/${companyId}`) &&
      response.url().includes("period=last-4-weeks") &&
      response.status() === 200,
    { timeout: 60_000 }
  )

  await page.goto(analyticsUrl, { waitUntil: "domcontentloaded" })
  await firstResponse

  await expect(page.getByText("Insights")).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText("Unable to reach the server")).toHaveCount(0)

  const periodSelect = page.locator("select").first()
  const secondResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/analytics/${companyId}`) &&
      response.url().includes("period=last-week") &&
      response.status() === 200,
    { timeout: 60_000 }
  )

  await periodSelect.selectOption("last-week")
  await secondResponse

  await expect(periodSelect).toHaveValue("last-week")
  await expect(page.getByText("Insights")).toBeVisible({ timeout: 60_000 })
})
