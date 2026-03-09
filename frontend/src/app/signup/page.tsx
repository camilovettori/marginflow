"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Loader2,
  Lock,
  Mail,
  Building2,
  User2,
  TrendingUp,
} from "lucide-react"
import {
  getMe,
  selectTenant,
  setAccessToken,
  type TenantBrief,
} from "@/services/api"

const API_URL = "http://127.0.0.1:8000"

type RegisterResponse = {
  access_token: string
  tenants: TenantBrief[]
}

function getFriendlyError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes("already exists")) {
    return "An account with this email already exists."
  }

  if (lower.includes("email")) {
    return "Please enter a valid email address."
  }

  if (lower.includes("password")) {
    return "Password does not meet the required rules."
  }

  if (lower.includes("workspace")) {
    return "Please enter a valid workspace name."
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Unable to reach the server. Check if the backend is running."
  }

  return message
}

async function registerUser(payload: {
  full_name: string
  email: string
  password: string
  workspace_name?: string
}): Promise<RegisterResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Register failed (${res.status})`)
  }

  return res.json() as Promise<RegisterResponse>
}

function Brand() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.14)]">
        <BarChart3 size={18} />
      </div>
      <div>
        <p className="text-[16px] font-semibold tracking-tight text-white">
          MarginFlow
        </p>
        <p className="text-xs text-white/56">Margin intelligence for operators</p>
      </div>
    </div>
  )
}

function GhostPreview() {
  return (
    <div className="mt-10 hidden max-w-[520px] xl:block">
      <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.035] p-5 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_24%)]" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                Workspace preview
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-white/88">
                Weekly margin visibility
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                Revenue
              </p>
              <p className="mt-2 text-xl font-semibold text-white/90">€40.9k</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                Labour %
              </p>
              <p className="mt-2 text-xl font-semibold text-white/90">27.8%</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                Net profit
              </p>
              <p className="mt-2 text-xl font-semibold text-white/90">€9.7k</p>
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.025] p-4">
            <div className="flex h-20 items-end gap-2">
              {[22, 28, 36, 33, 48, 58, 70].map((h, i) => (
                <div key={i} className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-white/90 to-white/40"
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.16em] text-white/28">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)

  const [tenants, setTenants] = useState<TenantBrief[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState("")
  const [step, setStep] = useState<"signup" | "tenant">("signup")

  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const me = await getMe()

        if (me?.tenant_id) {
          router.replace("/")
          return
        }
      } catch {
        // sem sessão válida
      } finally {
        setCheckingSession(false)
      }
    }

    checkExistingSession()
  }, [router])

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenant_id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  )

  function validateForm() {
    if (!fullName.trim()) {
      throw new Error("Full name is required.")
    }

    if (!workspaceName.trim()) {
      throw new Error("Workspace name is required.")
    }

    if (!email.trim()) {
      throw new Error("Email is required.")
    }

    if (!password.trim()) {
      throw new Error("Password is required.")
    }

    if (password.length < 8) {
      throw new Error("Password must have at least 8 characters.")
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.")
    }

    if (!acceptedPolicy) {
      throw new Error("You must accept the Terms and Privacy Policy.")
    }
  }

  async function handleSignupSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setLoading(true)
      setError(null)

      validateForm()

      const data = await registerUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
       
        // Se o backend ainda NÃO aceitar workspace_name,
        // remova esta linha acima.
      })

      if (!data.access_token) {
        throw new Error("Registration succeeded but no access token was returned.")
      }

      setAccessToken(data.access_token)

      if (!data.tenants?.length) {
        throw new Error("Registration succeeded but no tenant was created.")
      }

      if (data.tenants.length === 1) {
        await selectTenant(data.tenants[0].tenant_id)
        router.replace("/")
        return
      }

      setTenants(data.tenants)
      setSelectedTenantId(data.tenants[0].tenant_id)
      setStep("tenant")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create account."
      setError(getFriendlyError(message))
    } finally {
      setLoading(false)
    }
  }

  async function handleTenantContinue() {
    if (!selectedTenantId) {
      setError("Select a workspace to continue.")
      return
    }

    try {
      setLoading(true)
      setError(null)

      await selectTenant(selectedTenantId)
      router.replace("/")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to select workspace."
      setError(getFriendlyError(message))
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep("signup")
    setError(null)
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#090909] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur-xl">
            <Loader2 className="h-5 w-5 animate-spin text-white/75" />
            <span className="text-sm font-medium text-white/75">
              Checking your session...
            </span>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090909] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(99,102,241,0.15),transparent_20%),radial-gradient(circle_at_52%_100%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1420px] items-center px-6 py-10 sm:px-8 lg:px-10 xl:px-16">
        <div className="grid w-full grid-cols-1 items-center gap-12 xl:grid-cols-[1fr_0.9fr] xl:gap-18">
          <section className="flex flex-col justify-center">
            <Brand />

            <div className="mt-14 max-w-[640px]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/52">
                Weekly margin intelligence
              </p>

              <h1 className="mt-6 max-w-[620px] text-[54px] font-semibold leading-[0.94] tracking-[-0.06em] text-[#F3F4F6] sm:text-[66px] xl:text-[78px]">
                Start with a workspace built for margin visibility.
              </h1>

              <p className="mt-8 max-w-[540px] text-[18px] leading-8 text-white/74 sm:text-[20px] sm:leading-9">
                Create your account and start tracking revenue, labour and profit with clarity from week one.
              </p>
            </div>

            <GhostPreview />
          </section>

          <section className="flex items-center justify-center xl:justify-end">
            <div className="w-full max-w-[560px]">
              <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.97] p-8 text-zinc-950 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-10">
                <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(244,244,245,0.92),rgba(255,255,255,0))]" />
                <div className="absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-zinc-100 blur-3xl" />

                <div className="relative">
                  <div className="mb-9">
                    {step === "signup" && (
                      <div className="mb-4">
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
                        >
                          <ArrowLeft size={16} />
                          Back to sign in
                        </Link>
                      </div>
                    )}

                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                      {step === "signup" ? "Create account" : "Workspace access"}
                    </p>

                    <h2 className="mt-4 text-[40px] font-semibold leading-[0.96] tracking-[-0.06em] text-zinc-950 md:text-[46px]">
                      {step === "signup"
                        ? "Start with MarginFlow"
                        : "Choose your workspace"}
                    </h2>

                    <p className="mt-4 max-w-[440px] text-[15px] leading-7 text-zinc-500">
                      {step === "signup"
                        ? "Create your account and set up your first workspace."
                        : "Select the workspace you want to access for this session."}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  {step === "signup" ? (
                    <form onSubmit={handleSignupSubmit} className="space-y-5">
                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Full name
                        </label>
                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <User2
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                            autoComplete="name"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Workspace name
                        </label>
                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <Building2
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="text"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            placeholder="Camerino, Lovin, Group HQ..."
                            autoComplete="organization"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Email
                        </label>
                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <Mail
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            autoComplete="email"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Password
                        </label>
                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <Lock
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Confirm password
                        </label>
                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <Lock
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat your password"
                            autoComplete="new-password"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={acceptedPolicy}
                          onChange={(e) => setAcceptedPolicy(e.target.checked)}
                          className="sr-only"
                        />

                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            acceptedPolicy
                              ? "border-zinc-950 bg-zinc-950 text-white"
                              : "border-zinc-300 bg-white text-transparent"
                          }`}
                        >
                          <Check size={12} />
                        </div>

                        <span className="text-sm leading-6 text-zinc-600">
                          I agree to the{" "}
                          <Link
                            href="/terms"
                            className="font-medium text-zinc-950 hover:underline"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            className="font-medium text-zinc-950 hover:underline"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(24,24,27,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            Create account
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>

                      <p className="text-center text-sm text-zinc-500">
                        Already have an account?{" "}
                        <Link
                          href="/login"
                          className="font-semibold text-zinc-950 transition hover:text-zinc-700"
                        >
                          Sign in
                        </Link>
                      </p>
                    </form>
                  ) : (
                    <div>
                      <div className="space-y-3">
                        {tenants.map((tenant) => {
                          const isSelected = selectedTenantId === tenant.tenant_id

                          return (
                            <button
                              key={tenant.tenant_id}
                              type="button"
                              onClick={() => setSelectedTenantId(tenant.tenant_id)}
                              className={`w-full rounded-[24px] border p-5 text-left transition-all ${
                                isSelected
                                  ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_14px_30px_rgba(24,24,27,0.16)]"
                                  : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p
                                    className={`text-lg font-semibold tracking-tight ${
                                      isSelected ? "text-white" : "text-zinc-950"
                                    }`}
                                  >
                                    {tenant.name}
                                  </p>
                                  <p
                                    className={`mt-1 text-sm ${
                                      isSelected ? "text-zinc-300" : "text-zinc-500"
                                    }`}
                                  >
                                    {tenant.slug}
                                  </p>
                                </div>

                                <div
                                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                    isSelected
                                      ? "bg-white/10 text-zinc-200"
                                      : "bg-zinc-100 text-zinc-600"
                                  }`}
                                >
                                  {tenant.role}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Selected workspace:{" "}
                        <span className="font-semibold text-zinc-900">
                          {selectedTenant?.name || "None"}
                        </span>
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={loading}
                          className="h-14 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Back
                        </button>

                        <button
                          type="button"
                          onClick={handleTenantContinue}
                          disabled={loading || !selectedTenantId}
                          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(24,24,27,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Opening workspace...
                            </>
                          ) : (
                            <>
                              Enter workspace
                              <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}