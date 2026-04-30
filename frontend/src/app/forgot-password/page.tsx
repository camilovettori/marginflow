"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

export default function ForgotPasswordPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_24%),linear-gradient(135deg,#020617_0%,#07111f_46%,#02050c_100%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_26%),radial-gradient(circle_at_80%_14%,rgba(56,189,248,0.14),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:54px_54px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] items-center px-6 py-10 sm:px-8 lg:px-10">
        <div className="grid w-full grid-cols-1 gap-10 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-[0_12px_32px_rgba(255,255,255,0.12)]">
                <Image
                  src="/images/logologo.png"
                  alt="MarginFlow"
                  width={28}
                  height={28}
                  priority
                  className="h-7 w-7 object-contain mix-blend-screen"
                />
              </div>
              <div className="leading-tight">
                <p className="text-[15px] font-semibold tracking-tight text-white">
                  MarginFlow
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/54">
                  Margin intelligence for operators
                </p>
              </div>
            </div>

            <div className="mt-10 max-w-[620px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
                Account access
              </p>
              <h1 className="mt-6 text-[52px] font-semibold leading-[0.92] tracking-[-0.07em] text-[#F5F7FA] sm:text-[66px] xl:text-[80px]">
                Forgot your password?
              </h1>
              <p className="mt-7 max-w-[560px] text-[18px] leading-8 text-white/72 sm:text-[20px] sm:leading-9">
                Password recovery is not automated in this workspace yet. Return to sign in
                or contact your workspace administrator to regain access.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/74 backdrop-blur-xl">
                  <ShieldCheck className="h-4 w-4 text-cyan-300/80" />
                  <span>Secure access</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/74 backdrop-blur-xl">
                  <ShieldCheck className="h-4 w-4 text-cyan-300/80" />
                  <span>Managed by your workspace</span>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center xl:justify-end">
            <div className="w-full max-w-[500px] rounded-[36px] border border-white/20 bg-white/[0.98] p-8 text-zinc-950 shadow-[0_55px_140px_rgba(2,6,23,0.42)] ring-1 ring-white/45 md:p-10">
              <div className="rounded-[30px] border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                  Recovery help
                </p>
                <h2 className="mt-4 text-[34px] font-semibold leading-[0.96] tracking-[-0.06em] text-zinc-950 md:text-[40px]">
                  Need to regain access?
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-zinc-500">
                  If you are locked out, ask a workspace admin to reset access or invite you
                  again. This screen keeps the login path open without changing the current
                  auth flow.
                </p>

                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                  The sign-in page still supports the same login and tenant selection logic.
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/login"
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(24,24,27,0.18)] transition hover:bg-zinc-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
