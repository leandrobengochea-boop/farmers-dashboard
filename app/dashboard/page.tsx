import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { fetchAllDeals } from '@/lib/hubspot'
import { Deal, FetchValidation } from '@/lib/hubspot'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let deals: Deal[] = []
  let validation: FetchValidation = { totalBruto: 0, excludedFora: 0, totalLiquido: 0 }
  let fetchError: string | null = null

  try {
    const result = await fetchAllDeals()
    deals = result.deals
    validation = result.validation
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Erro ao buscar dados'
    console.error('Dashboard fetch error:', error)
  }

  return (
    <DashboardClient
      initialDeals={deals}
      validation={validation}
      userEmail={user.email ?? ''}
      fetchError={fetchError}
    />
  )
}
