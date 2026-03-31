import WorkspaceShell from "@/components/workspace-shell"

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params

  return (
    <WorkspaceShell mode="company" activeCompanyId={companyId}>
      {children}
    </WorkspaceShell>
  )
}
