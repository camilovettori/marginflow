"use client"

import { usePathname } from "next/navigation"
import TopBar from "./topbar"

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const hideTopBar =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"

  if (hideTopBar) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
