import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "@/components/layout-shell"

export const metadata: Metadata = {
  title: "MarginFlow",
  description: "Margin intelligence platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
