import { fetchAllDeals } from '@/lib/hubspot'
import { Deal, FetchValidation, ExcludedDeal } from '@/lib/hubspot'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let deals: Deal[] = []
  let validation: FetchValidation = { totalBruto: 0, excludedFora: 0, totalLiquido: 0 }
  let excludedDeals: ExcludedDeal[] = []
  let fetchError: string | null = null

  try {
    const result = await fetchAllDeals()
    deals = result.deals
    validation = result.validation
    excludedDeals = result.excludedDeals
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Erro ao buscar dados'
    console.error('Dashboard fetch error:', error)
  }

  return (
    <DashboardClient
      initialDeals={deals}
      validation={validation}
      excludedDeals={excludedDeals}
      fetchError={fetchError}
    />
  )
}
