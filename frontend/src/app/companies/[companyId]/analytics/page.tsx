"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

export default function CompanyAnalyticsPage() {
  const params = useParams()
  const companyId = params.companyId as string

  return (
    <main className="min-h-screen bg-white text-zinc-950 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href={`/companies/${companyId}`}
            className="inline-flex items-center rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Back to Company
          </Link>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-3 text-zinc-600">
          Analytics page restored. We can rebuild the full analytics screen safely from here.
        </p>
      </div>
    </main>
  )
}