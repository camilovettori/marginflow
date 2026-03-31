"use client"

import UserManagementCard from "@/components/user-management-card"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  deleteCompany,
  getCompanyById,
  getZohoConnectUrl,
  updateCompany,
  type Company,
} from "@/services/api"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  Lock,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
} from "lucide-react"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
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

function ReadOnlyField({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <span className="truncate">{value || "—"}</span>
        <Lock size={15} className="ml-3 shrink-0 text-zinc-400" />
      </div>
      {helper && <p className="mt-2 text-xs text-zinc-500">{helper}</p>}
    </div>
  )
}

export default function CompanySettingsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const companyId = params.companyId as string

  const [company, setCompany] = useState<Company | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [salesSource, setSalesSource] = useState<"manual" | "square" | "zoho">("manual")
  const [squareLocationId, setSquareLocationId] = useState("")
  const [zohoOrgId, setZohoOrgId] = useState("")
  const [integrationNotes, setIntegrationNotes] = useState("")

  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zohoConnected = searchParams.get("zoho_connected") === "1"
  const zohoOrgPending = searchParams.get("zoho_org_pending") === "1"
  const zohoError = searchParams.get("zoho_error")

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoading(true)
        setError(null)

        const companyData = await getCompanyById(companyId)

        setCompany(companyData)
        setName(companyData.name ?? "")
        setSlug(companyData.slug ?? "")
        setAddress(companyData.address ?? "")
        setContactName(companyData.contact_name ?? "")
        setPhone(companyData.phone ?? "")
        setEmail(companyData.email ?? "")
        setSalesSource((companyData.sales_source as "manual" | "square" | "zoho") ?? "manual")
        setSquareLocationId(companyData.square_location_id ?? "")
        setZohoOrgId(companyData.zoho_org_id ?? "")
        setIntegrationNotes(companyData.integration_notes ?? "")
      } catch (err) {
        console.error("Company settings load error:", err)
        setError(err instanceof Error ? err.message : "Failed to load company.")
      } finally {
        setLoading(false)
      }
    }

    loadCompany()
  }, [companyId])

  const suggestedSlug = useMemo(() => slugify(name), [name])

  async function handleSave() {
    try {
      setError(null)

      if (!name.trim()) {
        throw new Error("Company name is required.")
      }

      if (!slug.trim()) {
        throw new Error("Slug is required.")
      }

      setSaving(true)

      const updated = await updateCompany(companyId, {
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || null,
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        sales_source: salesSource,
        square_location_id:
          salesSource === "square" ? squareLocationId.trim() || null : null,
        zoho_org_id: salesSource === "zoho" ? zohoOrgId.trim() || null : null,
        integration_notes: integrationNotes.trim() || null,
      })

      setCompany(updated)
      router.push(`/companies/${companyId}`)
    } catch (err) {
      console.error("Company save error:", err)
      setError(err instanceof Error ? err.message : "Failed to save company.")
    } finally {
      setSaving(false)
    }
  }

  function handleConnectZoho() {
    window.location.href = getZohoConnectUrl(companyId)
  }

  async function handleDelete() {
    try {
      if (!company) return

      if (deleteConfirmName.trim() !== company.name.trim()) {
        throw new Error("Type the company name exactly to enable deletion.")
      }

      setError(null)
      setDeleting(true)

      await deleteCompany(companyId)
      router.push("/")
    } catch (err) {
      console.error("Company delete error:", err)
      setError(err instanceof Error ? err.message : "Failed to delete company.")
    } finally {
      setDeleting(false)
    }
  }

  function renderZohoStatusBadge() {
    if (zohoOrgId) {
      return (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700">
          Org linked
        </span>
      )
    }

    if (zohoConnected && zohoOrgPending) {
      return (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-700">
          Connected, org pending
        </span>
      )
    }

    if (zohoError) {
      return (
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-rose-700">
          Connection failed
        </span>
      )
    }

    if (integrationNotes.toLowerCase().includes("zoho connected")) {
      return (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
          Connected
        </span>
      )
    }

    return (
      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Not connected yet
      </span>
    )
  }

  function renderZohoHelperMessage() {
    if (zohoError) {
      return (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Zoho connection failed. Please try again or review the Zoho OAuth configuration.
        </div>
      )
    }

    if (zohoConnected && zohoOrgPending) {
      return (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Zoho authorization succeeded, but no active Zoho Invoice organization was found on this
          account yet.
        </div>
      )
    }

    if (zohoOrgId) {
      return (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Zoho Invoice is connected and ready for historical sales sync.
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4">
                <Link
                  href={`/companies/${companyId}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to {company?.name ?? "Company"}
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                  Company Settings
                </h2>
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 shadow-sm">
                  {company?.name ?? "Workspace"}
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
                Manage company details, sales-source configuration, team access, and destructive
                actions from one place.
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
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading company settings...</p>
            </div>
          ) : (
            <>
              <div className="rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
                <div className="border-b border-zinc-100 px-7 py-6">
                  <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                    Company Details
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Keep company information accurate, client-facing, and consistent across the
                    workspace.
                  </p>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <Field
                      label="Company Name"
                      value={name}
                      onChange={setName}
                      placeholder="Company name"
                    />

                    <ReadOnlyField
                      label="Slug"
                      value={slug || suggestedSlug || "company-slug"}
                      helper="The slug is treated as a stable internal identifier and is not editable here."
                    />

                    <Field
                      label="Address"
                      value={address}
                      onChange={setAddress}
                      placeholder="Company address"
                    />

                    <Field
                      label="Manager / Main Contact"
                      value={contactName}
                      onChange={setContactName}
                      placeholder="Main contact name"
                    />

                    <Field
                      label="Phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="Phone number"
                    />

                    <Field
                      label="Email"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="Email address"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
                <div className="border-b border-zinc-100 px-7 py-6">
                  <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                    Sales Source
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Choose how this company will provide sales data to MarginFlow.
                  </p>
                </div>

                <div className="p-6">
                  <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                    <button
                      type="button"
                      onClick={() => setSalesSource("manual")}
                      className={`rounded-xl px-4 py-2 text-sm transition ${
                        salesSource === "manual"
                          ? "bg-white text-zinc-950 shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesSource("square")}
                      className={`rounded-xl px-4 py-2 text-sm transition ${
                        salesSource === "square"
                          ? "bg-white text-zinc-950 shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      Square
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesSource("zoho")}
                      className={`rounded-xl px-4 py-2 text-sm transition ${
                        salesSource === "zoho"
                          ? "bg-white text-zinc-950 shadow-sm"
                          : "text-zinc-500"
                      }`}
                    >
                      Zoho
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {salesSource === "manual" && (
                      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5 xl:col-span-2">
                        <h4 className="text-lg font-semibold text-zinc-950">Manual Sales Entry</h4>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          Weekly sales are entered manually through the reporting workflow. This is
                          the fastest way to get started and the most reliable setup while automatic
                          connectors are still being prepared.
                        </p>
                      </div>
                    )}

                    {salesSource === "square" && (
                      <>
                        <Field
                          label="Square Location ID"
                          value={squareLocationId}
                          onChange={setSquareLocationId}
                          placeholder="Square location / store reference"
                        />
                        <Field
                          label="Integration Notes"
                          value={integrationNotes}
                          onChange={setIntegrationNotes}
                          placeholder="Optional setup note or internal reference"
                        />
                      </>
                    )}

                    {salesSource === "zoho" && (
                      <>
                        <Field
                          label="Zoho Org / Reference ID"
                          value={zohoOrgId}
                          onChange={setZohoOrgId}
                          placeholder="Zoho organization ID"
                        />

                        <Field
                          label="Integration Notes"
                          value={integrationNotes}
                          onChange={setIntegrationNotes}
                          placeholder="Optional setup note or internal reference"
                        />

                        <div className="xl:col-span-2 rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                          <h4 className="text-lg font-semibold text-zinc-950">
                            Connect Zoho Invoice
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-zinc-600">
                            Connect this company to Zoho Invoice to authorize access and import
                            sales history.
                          </p>

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={handleConnectZoho}
                              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95"
                            >
                              Connect Zoho Invoice
                            </button>

                            {renderZohoStatusBadge()}
                          </div>

                          {renderZohoHelperMessage()}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
                    <h4 className="text-lg font-semibold text-zinc-950">Integration roadmap</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      Square and Zoho connectivity will be added next. For now, this company can
                      continue operating with manual weekly sales entry while the integration layer
                      is finalized.
                    </p>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save size={16} />
                      {saving ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>

              {company?.tenant_id && <UserManagementCard tenantId={company.tenant_id} />}

              <div className="mt-8 rounded-[28px] border border-rose-200 bg-white shadow-sm">
                <div className="border-b border-rose-100 px-7 py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="text-[1.9rem] font-semibold tracking-tight text-rose-700">
                        Danger Zone
                      </h3>
                      <p className="mt-1.5 text-sm text-zinc-500">
                        Destructive actions should be used carefully and deliberately.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5">
                    <h4 className="text-lg font-semibold text-zinc-950">Delete Company</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      This permanently deletes the company. If related reports exist, associated
                      data may also be removed depending on your database rules. This action cannot
                      be undone.
                    </p>

                    <div className="mt-5 max-w-xl">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Type the company name to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={company?.name || "Company name"}
                        className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-rose-400"
                      />
                      <p className="mt-2 text-xs text-zinc-500">
                        Required value:{" "}
                        <span className="font-medium text-zinc-700">{company?.name}</span>
                      </p>
                    </div>

                    <div className="mt-5">
                      <button
                        onClick={handleDelete}
                        disabled={
                          deleting || deleteConfirmName.trim() !== (company?.name ?? "").trim()
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        {deleting ? "Deleting..." : "Delete Company"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
    </div>
  )
}
