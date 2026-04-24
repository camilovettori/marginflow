"use client"

import { type ReactNode, useEffect } from "react"

type ConfirmDialogProps = {
  open: boolean
  title: ReactNode
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
        <div className="mt-2 text-sm leading-6 text-zinc-600">{description}</div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60 ${
              destructive ? "bg-rose-600 hover:bg-rose-500" : "bg-zinc-950 hover:opacity-90"
            }`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
