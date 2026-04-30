"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
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
    <div className="inline-flex items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 52 44"
        className="h-11 w-11 shrink-0"
        fill="none"
      >
        <rect x="7" y="18" width="5" height="11" rx="1.2" fill="#E2E8F0" />
        <rect x="17" y="10" width="5" height="19" rx="1.2" fill="#F8FAFC" />
        <rect x="27" y="4" width="5" height="25" rx="1.2" fill="#1D4ED8" />
        <path
          d="M5 31.5C9.2 28.2 12.3 26.1 15.4 25.5C18.6 24.8 21.4 25.2 24 26.5C26.4 27.7 28.8 29.8 31.4 31.2C34.3 32.8 37.6 33 42 31.5"
          stroke="url(#mfCurve)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="mfCurve" x1="5" y1="24" x2="42" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      </svg>

      <div className="leading-none tracking-[-0.08em]">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[34px] font-semibold text-white sm:text-[36px] xl:text-[40px]">
            Margin
          </span>
          <span className="text-[34px] font-semibold text-blue-500 sm:text-[36px] xl:text-[40px]">
            Flow
          </span>
        </div>
      </div>
    </div>
  )
}

function WeeklySnapshotPreview() {
  return (
    <div className="relative mt-10 w-full max-w-[620px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.86),rgba(8,15,28,0.7))] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.28)] backdrop-blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_26%)]" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
          Weekly margin snapshot
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Revenue
            </p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-white/95">
              EUR 40.9k
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Labour %
            </p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-white/95">
              27.8%
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Net Profit
            </p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-white/95">
              EUR 9.7k
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.78),rgba(15,23,42,0.4))] p-4">
          <div className="relative h-32 overflow-hidden rounded-[20px] border border-white/6 bg-[linear-gradient(180deg,rgba(8,15,28,0.95),rgba(15,23,42,0.45))]">
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
            <svg
              viewBox="0 0 100 42"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <path
                d="M0 31 C 10 28, 18 24, 26 26 S 40 18, 50 20 S 64 14, 74 16 S 88 9, 100 12"
                fill="none"
                stroke="rgba(125,211,252,0.95)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M0 35 C 11 30, 18 28, 26 30 S 41 22, 50 23 S 64 18, 74 19 S 88 13, 100 15"
                fill="none"
                stroke="rgba(96,165,250,0.45)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute inset-x-0 bottom-0 flex h-[74%] items-end gap-2 px-4 pb-4">
              {[30, 40, 55, 42, 68, 79, 63].map((height, index) => (
                <div key={index} className="flex-1">
                  <div
                    className="w-full rounded-t-[14px] bg-[linear-gradient(180deg,rgba(191,219,254,0.92),rgba(37,99,235,0.34))] shadow-[0_0_24px_rgba(56,189,248,0.18)]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
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
        // no valid session
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

      root.style.setProperty("--login-hero-x", `${current.x * 6}px`)
      root.style.setProperty("--login-hero-y", `${current.y * 5}px`)
      root.style.setProperty("--login-card-x", `${current.x * 4}px`)
      root.style.setProperty("--login-card-y", `${current.y * 3}px`)

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
      <main className="min-h-screen bg-[linear-gradient(135deg,#020617_0%,#07111f_52%,#02050c_100%)] text-white">
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
    <main
      ref={pageRef}
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#050b16_45%,#02050c_100%)] text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_28%,rgba(37,99,235,0.28),transparent_28%),radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.18),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.03),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.014),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="absolute right-0 top-0 hidden h-full w-[60vw] overflow-hidden xl:block">
        <LoginAtmosphere3D />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1560px] items-center px-6 py-8 sm:px-8 lg:px-10 xl:px-14">
        <div className="grid w-full grid-cols-1 items-center gap-10 xl:grid-cols-[minmax(0,1.16fr)_460px] xl:gap-10">
          <section
            className="relative z-10 flex flex-col justify-center xl:pl-[2vw]"
            style={{
              transform: "translate3d(var(--login-hero-x, 0px), var(--login-hero-y, 0px), 0)",
            }}
          >
            <div className="max-w-[760px]">
              <Brand />

              <div className="mt-12 max-w-[620px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/50">
                  Financial visibility for operators
                </p>
                <h1 className="mt-6 max-w-[580px] text-[56px] font-semibold leading-[0.9] tracking-[-0.075em] text-white sm:text-[70px] xl:text-[84px]">
                  Understand
                  <br />
                  where margin is built.
                </h1>
                <p className="mt-7 max-w-[540px] text-[18px] leading-8 text-zinc-300 sm:text-[20px] sm:leading-9">
                  Weekly clarity across revenue, labour and profit for multi-company
                  operators.
                </p>
              </div>

              <WeeklySnapshotPreview />
            </div>
          </section>

          <section className="relative z-20 flex items-center justify-center xl:justify-center">
            <div
              className="w-full max-w-[460px] transition-transform duration-300 ease-out"
              style={{
                transform: "translate3d(var(--login-card-x, 0px), var(--login-card-y, 0px), 0)",
              }}
            >
              <div className="relative overflow-hidden rounded-[36px] border border-white/18 bg-white/[0.985] p-7 text-zinc-950 shadow-[0_55px_140px_rgba(2,6,23,0.42)] ring-1 ring-white/45 md:p-8">
                <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(244,244,245,0.96),rgba(255,255,255,0))]" />
                <div className="absolute left-[-50px] top-16 h-44 w-44 rounded-full bg-sky-100/60 blur-3xl" />
                <div className="relative">
                  <div className="mb-7">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-zinc-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] md:h-14 md:w-14">
                      <Image
                        src="/images/logo1.png"
                        alt="MarginFlow"
                        width={64}
                        height={64}
                        priority
                        className="h-8 w-8 object-contain md:h-9 md:w-9"
                      />
                    </div>
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                      {step === "login" ? "Welcome back" : "Workspace access"}
                    </p>

                    <h2 className="mt-2.5 text-center text-[38px] font-semibold leading-[0.98] tracking-[-0.06em] text-zinc-950 md:text-[44px]">
                      {step === "login"
                        ? "Sign in to MarginFlow"
                        : "Choose your workspace"}
                    </h2>

                  </div>

                  {error && (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  {step === "login" ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-4.5">
                      <div>
                        <label className="mb-2.5 block text-sm font-medium text-zinc-700">
                          Email
                        </label>
                    <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
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

                    <div className="group flex h-14 items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
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
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(24,24,27,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-[0_24px_40px_rgba(24,24,27,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
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

                      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="mt-0.5 h-4 w-4 text-zinc-500" />
                          <span>Secure tenant-based access for authorised members only.</span>
                        </div>
                      </div>

                      <p className="pt-1 text-center text-sm text-zinc-500">
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
