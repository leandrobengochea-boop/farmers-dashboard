'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Deal, FetchValidation } from '@/lib/hubspot'
import Navbar from './Navbar'
import SummaryCards from './SummaryCards'
import FarmerRanking from './FarmerRanking'
import ScoreDistribution from './ScoreDistribution'
import CriteriaAnalysis from './CriteriaAnalysis'
import DealsTable from './DealsTable'
import {
  computeFarmerRanking,
  computeScoreDistribution,
  computeCriteriaAnalysis,
  computeSummaryStats,
  filterDealsByMonth,
  getAvailableMonths,
} from '@/lib/analytics'

interface DashboardClientProps {
  initialDeals: Deal[]
  validation: FetchValidation
  userEmail: string
  fetchError: string | null
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return format(date, 'MMMM/yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
}

export default function DashboardClient({
  initialDeals,
  validation: initialValidation,
  userEmail,
  fetchError: initialError,
}: DashboardClientProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [validation, setValidation] = useState<FetchValidation>(initialValidation)
  const [fetchError, setFetchError] = useState<string | null>(initialError)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/deals?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { deals: Deal[]; validation: FetchValidation }
      setDeals(data.deals)
      setValidation(data.validation)
      setLastUpdated(new Date())
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erro ao atualizar dados')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const availableMonths = useMemo(() => getAvailableMonths(deals), [deals])

  const filteredDeals = useMemo(
    () => filterDealsByMonth(deals, selectedMonth),
    [deals, selectedMonth]
  )

  const farmerRanking = useMemo(() => computeFarmerRanking(filteredDeals), [filteredDeals])
  const scoreDistribution = useMemo(() => computeScoreDistribution(filteredDeals), [filteredDeals])
  const { absence, impact } = useMemo(() => computeCriteriaAnalysis(filteredDeals), [filteredDeals])
  const summaryStats = useMemo(() => computeSummaryStats(filteredDeals), [filteredDeals])

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar userEmail={userEmail} onRefresh={handleRefresh} refreshing={refreshing} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Error Banner */}
        {fetchError && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-6 py-4 text-red-300">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm mt-1 text-red-400">{fetchError}</p>
          </div>
        )}

        {/* Validation + last updated */}
        {validation.totalBruto > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-800/60 border border-slate-700 rounded-xl px-6 py-3 text-sm">
            <span className="text-slate-400">
              Bruto: <span className="text-white font-medium">{validation.totalBruto}</span>
            </span>
            <span className="text-slate-600 hidden sm:block">|</span>
            <span className="text-slate-400">
              Excluídos (Fora do MOA):{' '}
              <span className={validation.excludedFora > 0 ? 'text-yellow-400 font-medium' : 'text-white font-medium'}>
                {validation.excludedFora}
              </span>
            </span>
            <span className="text-slate-600 hidden sm:block">|</span>
            <span className="text-slate-400">
              Total líquido:{' '}
              <span className="text-indigo-400 font-semibold">{validation.totalLiquido}</span>
            </span>
            <span className="text-slate-600 hidden sm:block">|</span>
            <span className="text-slate-500 text-xs">
              Atualizado às {format(lastUpdated, "HH:mm 'de' dd/MM", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="flex items-center gap-4">
          <label htmlFor="month-filter" className="text-slate-400 text-sm font-medium whitespace-nowrap">
            Período:
          </label>
          <select
            id="month-filter"
            value={selectedMonth ?? ''}
            onChange={(e) => setSelectedMonth(e.target.value || null)}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Todos os meses</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
          {selectedMonth && (
            <span className="text-slate-400 text-sm">
              <span className="text-white font-medium">{filteredDeals.length}</span> negócios em {formatMonthLabel(selectedMonth)}
            </span>
          )}
        </div>

        {/* Summary Cards */}
        <SummaryCards stats={summaryStats} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FarmerRanking data={farmerRanking} deals={filteredDeals} />
          <ScoreDistribution data={scoreDistribution} />
        </div>

        {/* Criteria Analysis */}
        <CriteriaAnalysis absence={absence} impact={impact} />

        {/* Deals Table */}
        <DealsTable deals={filteredDeals} />
      </main>
    </div>
  )
}
