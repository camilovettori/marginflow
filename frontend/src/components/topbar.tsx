"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, X } from "lucide-react"
import { getMe, logout, type MeResponse } from "@/services/api"

export default function TopBar() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function loadMe() {
      try {
        const meData = await getMe()
        setMe(meData)
      } catch {
        setMe(null)
      }
    }

    loadMe()
  }, [])

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus()
    }
  }, [searchOpen])

  async function handleLogout() {
    try {
      await logout()
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-zinc-200 bg-white/90 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        {!searchOpen ? (
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
            aria-label="Open search"
            title="Search"
          >
            <Search size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <Search size={16} className="text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              className="w-56 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close search"
              title="Close search"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <button
          className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-200 text-sm font-semibold text-zinc-700">
            {me?.full_name?.[0]?.toUpperCase() || "U"}
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-zinc-900">
              {me?.full_name || "User"}
            </p>
            <p className="text-xs text-zinc-500">{me?.email || ""}</p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}