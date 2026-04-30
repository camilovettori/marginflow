"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  Loader2,
  Lock,
  Mail,
  TrendingUp,
} from "lucide-react"
import {
  getMe,
  login,
  selectTenant,
  type TenantBrief,
} from "@/services/api"

const LoginAtmosphere3D = dynamic(
  () => import("@/components/login/login-atmosphere-3d"),
  { ssr: false }
)

function getFriendlyError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again."
  }

  if (lower.includes("missing refresh cookie")) {
    return "Your session could not be restored. Please sign in again."
  }

  if (lower.includes("invalid token")) {
    return "Your session is no longer valid. Please sign in again."
  }

  if (lower.includes("session expired")) {
    return "Your session expired. Please sign in again."
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Unable to reach the server. Check if the backend is running."
  }

  return message
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
      <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.035] p-5 backdrop-blur-xl login-card-animate">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_18%,rgba(255,255,255,0.08)_34%,transparent_50%)] opacity-40 login-sweep-animate" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                Weekly margin snapshot
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-white/88">
                Revenue, labour, margin
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300 login-hero-glow">
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
            <div className="flex items-end gap-2 h-20">
              {[22, 28, 36, 33, 48, 58, 70].map((h, i) => (
                <div key={i} className="flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-white/90 to-white/40 login-bar-life"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 140}ms`,
                    }}
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

export default function LoginPage() {
  const router = useRouter()
  const pageRef = useRef<HTMLDivElement>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [tenants, setTenants] = useState<TenantBrief[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState("")
  const [step, setStep] = useState<"login" | "tenant">("login")
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

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

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const applyMotion = () => setReducedMotion(media.matches)
    applyMotion()
    media.addEventListener?.("change", applyMotion)

    return () => {
      media.removeEventListener?.("change", applyMotion)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || reducedMotion) return

    const root = pageRef.current
    if (!root) return

    let frame = 0
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }

    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      target.x = x
      target.y = y
    }

    const onLeave = () => {
      target.x = 0
      target.y = 0
    }

    const tick = () => {
      current.x += (target.x - current.x) * 0.06
      current.y += (target.y - current.y) * 0.06

      const heroX = current.x * 8
      const heroY = current.y * 6
      const cardX = current.x * 4
      const cardY = current.y * 3

      root.style.setProperty("--login-hero-x", `${heroX}px`)
      root.style.setProperty("--login-hero-y", `${heroY}px`)
      root.style.setProperty("--login-card-x", `${cardX}px`)
      root.style.setProperty("--login-card-y", `${cardY}px`)
      root.style.setProperty("--login-orb-x", `${current.x * 14}px`)
      root.style.setProperty("--login-orb-y", `${current.y * 10}px`)

      frame = window.requestAnimationFrame(tick)
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerleave", onLeave)
    frame = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerleave", onLeave)
      window.cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenant_id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  )

  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setLoading(true)
      setError(null)

      const data = await login(email.trim().toLowerCase(), password)

      if (!data.tenants.length) {
        throw new Error("No tenants available for this user.")
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
      const message = err instanceof Error ? err.message : "Unable to sign in."
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

  function handleBackToLogin() {
    setStep("login")
    setTenants([])
    setSelectedTenantId("")
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
    <main ref={pageRef} className="relative min-h-screen overflow-hidden bg-[#090909] text-white">
      <div className="pointer-events-none absolute inset-0 z-0">
        <LoginAtmosphere3D />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(99,102,241,0.15),transparent_20%),radial-gradient(circle_at_52%_100%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1420px] items-center px-6 py-10 sm:px-8 lg:px-10 xl:px-16">
        <div className="grid w-full grid-cols-1 items-center gap-12 xl:grid-cols-[1fr_0.9fr] xl:gap-18">
          <section
            className="relative flex flex-col justify-center transition-transform duration-300 ease-out"
            style={{
              transform: "translate3d(var(--login-hero-x, 0px), var(--login-hero-y, 0px), 0)",
            }}
          >
            <div className="relative z-10">
              <Brand />

              <div className="mt-14 max-w-[640px]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/52">
                  Financial visibility for operators
                </p>

                <h1 className="mt-6 max-w-[580px] text-[54px] font-semibold leading-[0.94] tracking-[-0.06em] text-[#F3F4F6] sm:text-[66px] xl:text-[78px]">
                  Understand where margin is built.
                </h1>

                <p className="mt-8 max-w-[540px] text-[18px] leading-8 text-white/74 sm:text-[20px] sm:leading-9">
                  Weekly clarity across revenue, labour and profit for multi-company operators.
                </p>
              </div>

              <GhostPreview />
            </div>
          </section>

          <section className="flex items-center justify-center xl:justify-end">
            <div
              className="w-full max-w-[540px] transition-transform duration-300 ease-out"
              style={{
                transform: "translate3d(var(--login-card-x, 0px), var(--login-card-y, 0px), 0)",
              }}
            >
              <div className="relative overflow-hidden rounded-[36px] border border-white/18 bg-white/[0.985] p-8 text-zinc-950 shadow-[0_55px_140px_rgba(2,6,23,0.42)] ring-1 ring-white/45 md:p-10 login-card-animate">
                <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(244,244,245,0.96),rgba(255,255,255,0))]" />
                <div className="absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-zinc-100/80 blur-3xl" />

                <div className="relative">
                  <div className="mb-9">
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                      {step === "login" ? "Welcome back" : "Workspace access"}
                    </p>

                    <h2 className="mt-4 text-[40px] font-semibold leading-[0.96] tracking-[-0.06em] text-zinc-950 md:text-[46px]">
                      {step === "login"
                        ? "Sign in to MarginFlow"
                        : "Choose your workspace"}
                    </h2>

                    <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-zinc-500">
                      {step === "login"
                        ? "Access your tenant dashboard and continue where you left off."
                        : "Select the workspace you want to access for this session."}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  {step === "login" ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-5">
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
                        <div className="mb-2.5 flex items-center justify-between gap-4">
                          <label className="block text-sm font-medium text-zinc-700">
                            Password
                          </label>
                          <Link
                            href="/forgot-password"
                            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
                          >
                            Forgot password?
                          </Link>
                        </div>

                        <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm transition-all duration-200 focus-within:border-zinc-950 focus-within:ring-4 focus-within:ring-zinc-950/5">
                          <Lock
                            size={18}
                            className="text-zinc-400 transition group-focus-within:text-zinc-700"
                          />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(24,24,27,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign in
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Secure tenant-based access for authorised members only.
                      </div>

                      <p className="text-center text-sm text-zinc-500">
                        Don&apos;t have an account?{" "}
                        <Link
                          href="/signup"
                          className="font-semibold text-zinc-950 transition hover:text-zinc-700"
                        >
                          Create one
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
                          onClick={handleBackToLogin}
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
