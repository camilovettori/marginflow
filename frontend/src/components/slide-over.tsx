"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

export default function SlideOver({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[600px] flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <span className="text-sm font-semibold text-zinc-950">{title}</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
