"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { deleteCompany, getCompanyById, updateCompany, type Company } from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
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

export default function CompanySettingsPage() {
  const params = useParams()
  const router = useRouter()
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function handleDelete() {
    try {
      const confirmed = window.confirm(
        "Delete this company? This action cannot be undone and may remove associated data."
      )

      if (!confirmed) return

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
                <span className="truncate">{company?.name ?? "Company"}</span>
              </Link>

              <Link
                href="/companies/new"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-white/70"
              >
                <Plus size={16} />
                <span>Add Company</span>
              </Link>
            </div>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Weekly Reports</div>
            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Analytics</div>
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Company Settings</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Edit company details, configure sales source, and manage deletion.
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
                Company Settings
              </h2>
              <p className="mt-3 text-base text-zinc-500">
                Manage this company’s details, integrations, and administrative actions.
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
                    Keep company information accurate and up to date.
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

                    <Field
                      label="Slug"
                      value={slug}
                      onChange={setSlug}
                      placeholder={suggestedSlug || "company-slug"}
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
                    Choose how this company should provide sales data to MarginFlow.
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
                          Weekly sales will be entered manually in the report form. This is the
                          default and simplest setup.
                        </p>
                      </div>
                    )}

                    {salesSource === "square" && (
                      <>
                        <Field
                          label="Square Location ID"
                          value={squareLocationId}
                          onChange={setSquareLocationId}
                          placeholder="Square location/store reference"
                        />
                        <Field
                          label="Integration Notes"
                          value={integrationNotes}
                          onChange={setIntegrationNotes}
                          placeholder="Optional Square notes or setup reference"
                        />
                      </>
                    )}

                    {salesSource === "zoho" && (
                      <>
                        <Field
                          label="Zoho Org / Reference ID"
                          value={zohoOrgId}
                          onChange={setZohoOrgId}
                          placeholder="Zoho org ID or integration reference"
                        />
                        <Field
                          label="Integration Notes"
                          value={integrationNotes}
                          onChange={setIntegrationNotes}
                          placeholder="Optional Zoho notes or setup reference"
                        />
                      </>
                    )}
                  </div>

                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
                    <h4 className="text-lg font-semibold text-zinc-950">Integration Roadmap</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      This now saves the intended sales source and integration references in proper
                      company fields. Next step is connecting OAuth and automatic sales import for
                      Square and Zoho.
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

              <div className="mt-8 rounded-[28px] border border-rose-200 bg-white shadow-sm">
                <div className="border-b border-rose-100 px-7 py-6">
                  <h3 className="text-[1.9rem] font-semibold tracking-tight text-rose-700">
                    Danger Zone
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Destructive actions should be used carefully.
                  </p>
                </div>

                <div className="p-6">
                  <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5">
                    <h4 className="text-lg font-semibold text-zinc-950">Delete Company</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      This permanently deletes the company. If related reports exist, this may also
                      remove associated data depending on your database rules.
                    </p>

                    <div className="mt-5">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
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
        </section>
      </div>
    </main>
  )
}