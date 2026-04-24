import { redirect } from "next/navigation"

type CostingRedirectPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function CostingRedirectPage({ params }: CostingRedirectPageProps) {
  const { companyId } = await params
  redirect(`/companies/${companyId}/costing/purchase-invoices`)
}
