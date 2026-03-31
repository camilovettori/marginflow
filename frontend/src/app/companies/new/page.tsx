"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Save } from "lucide-react"
import { createCompany } from "@/services/api"
import WorkspaceShell from "@/components/workspace-shell"

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
  const [error, setError] = useState<string | null>(null)

  const suggestedSlug = useMemo(() => slugify(name), [name])

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
      setError(err instanceof Error ? err.message : "Failed to create company.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspaceShell mode="tenant">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowLeft size={16} />
              Back to Companies
            </Link>

            <h2 className="mt-5 text-5xl font-semibold tracking-tight text-zinc-950">
              Add Company
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-500">
              Create a new company and add its core business details.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Creating..." : "Create Company"}
          </button>
        </div>

        {error && (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-[30px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-7 py-6">
            <h3 className="text-[1.9rem] font-semibold tracking-tight text-zinc-950">
              Company details
            </h3>
            <p className="mt-1.5 text-sm text-zinc-500">
              Keep the name and contact fields clean so the workspace stays premium from the start.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-2">
            <Field
              label="Company Name"
              value={name}
              onChange={setName}
              placeholder="Company name"
              required
            />
            <Field
              label="Slug"
              value={slug}
              onChange={setSlug}
              placeholder={suggestedSlug || "company-slug"}
              required
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

        <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Plus size={18} className="text-zinc-500" />
            <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Next step</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-zinc-500">
            After you create the company, you’ll land in its dedicated workspace where reports,
            analytics, and future Budget / Forecast planning live together.
          </p>
        </div>
      </div>
    </WorkspaceShell>
  )
}
