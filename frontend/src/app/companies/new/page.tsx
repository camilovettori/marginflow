"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  createCompany,
  getMe,
  type MeResponse,
} from "@/services/api"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Plus,
  Save,
  Settings,
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
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </label>
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

export default function NewCompanyPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [address, setAddress] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [saving, setSaving] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const suggestedSlug = useMemo(() => slugify(name), [name])

  useEffect(() => {
    async function checkSession() {
      try {
        const meData = await getMe()
        setMe(meData)

        if (!meData.tenant_id) {
          router.push("/login")
          return
        }
      } catch {
        router.push("/login")
        return
      } finally {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  async function handleCreate() {
    try {
      setError(null)

      if (!name.trim()) {
        throw new Error("Company name is required.")
      }

      const finalSlug = (slug.trim() || suggestedSlug).trim()

      if (!finalSlug) {
        throw new Error("Slug is required.")
      }

      setSaving(true)

      const created = await createCompany({
        name: name.trim(),
        slug: finalSlug,
        address: address.trim() || null,
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      })

      router.push(`/companies/${created.id}`)
    } catch (err) {
      console.error("Create company error:", err)

      const message =
        err instanceof Error ? err.message : "Failed to create company."

      if (
        message.toLowerCase().includes("session expired") ||
        message.toLowerCase().includes("401") ||
        message.toLowerCase().includes("missing bearer token") ||
        message.toLowerCase().includes("invalid token")
      ) {
        router.push("/login")
        return
      }

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (checkingSession) {
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
          </aside>

          <section className="px-6 py-7 md:px-8 xl:px-10">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-zinc-500">Loading company form...</p>
            </div>
          </section>
        </div>
      </main>
    )
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
                href="/companies/new"
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200"
              >
                <Plus size={16} />
                <span>Add Company</span>
              </Link>
            </div>

            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Weekly Reports</div>
            <div className="rounded-2xl px-4 py-3 text-sm text-zinc-500">Analytics</div>
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">New Company</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Create a new company inside this tenant.
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
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  Back to Dashboard
                </Link>
              </div>

              <h2 className="text-5xl font-semibold tracking-tight text-zinc-950">
                Add Company
              </h2>
              <p className="mt-3 text-base text-zinc-500">
                Create a new company and add its core business details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Creating..." : "Create Company"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-[28px] border border-zinc-200 bg-white/95 shadow-sm">
            <div className="border-b border-zinc-100 px-7 py-6">
              <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
                Company Details
              </h3>
              <p className="mt-1.5 text-sm text-zinc-500">
                Only company name is required. The rest can be added now or later.
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Field
                  label="Company Name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Camerino Cafe"
                  required
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
                  placeholder="Business address"
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

              <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-zinc-100 p-3 text-zinc-700">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-zinc-950">Professional default</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      Start with the company name and let the system generate a clean slug.
                      Contact details can be filled now or later in company settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? "Creating Company..." : "Create Company"}
                </button>

                <Link
                  href="/"
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