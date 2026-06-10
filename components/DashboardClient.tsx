'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Deal, FetchValidation, ForaDoMOAEntry } from '@/lib/hubspot'
import { TEAMS } from '@/lib/constants'
import Navbar from './Navbar'
import SummaryCards from './SummaryCards'
import FarmerRanking from './FarmerRanking'
import ScoreDistribution from './ScoreDistribution'
import CriteriaAnalysis from './CriteriaAnalysis'
import DealsTable from './DealsTable'
import { MacroKPIBar, InsightList } from './insights/InsightCards'
import FarmerMatrix from './insights/FarmerMatrix'
import {
  computeFarmerRanking,
  computeScoreDistribution,
  computeCriteriaAnalysis,
  computeSummaryStats,
  filterDealsByMonth,
  filterDealsByTeam,
  getAvailableMonths,
} from '@/lib/analytics'
import {
  computeFarmerMatrix,
  computeMacroKPIs,
  generateInsights,
} from '@/lib/insights'

interface DashboardClientProps {
  initialDeals: Deal[]
  validation: FetchValidation
  foraDoMOA: ForaDoMOAEntry[]
  fetchError: string | null
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return format(date, 'MMMM/yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
}

const TEAM_OPTIONS = [
  { value: '', label: 'Todos os Farmers' },
  ...Object.entries(TEAMS).map(([key, t]) => ({ value: key, label: t.label })),
]

export default function DashboardClient({
  initialDeals,
  validation: initialValidation,
  foraDoMOA: initialForaDoMOA,
  fetchError: initialError,
}: DashboardClientProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [validation, setValidation] = useState<FetchValidation>(initialValidation)
  const [foraDoMOA, setForaDoMOA] = useState<ForaDoMOAEntry[]>(initialForaDoMOA)
  const [fetchError, setFetchError] = useState<string | null>(initialError)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/deals?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { deals: Deal[]; validation: FetchValidation; foraDoMOA: ForaDoMOAEntry[] }
      setDeals(data.deals)
      setValidation(data.validation)
      setForaDoMOA(data.foraDoMOA ?? [])
      setLastUpdated(new Date())
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erro ao atualizar dados')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const availableMonths = useMemo(() => getAvailableMonths(deals), [deals])

  const filteredDeals = useMemo(() => {
    const byTeam = filterDealsByTeam(deals, selectedTeam)
    return filterDealsByMonth(byTeam, selectedMonth)
  }, [deals, selectedMonth, selectedTeam])

  const farmerRanking = useMemo(() => computeFarmerRanking(filteredDeals), [filteredDeals])
  const scoreDistribution = useMemo(() => computeScoreDistribution(filteredDeals), [filteredDeals])
  const { absence, impact } = useMemo(() => computeCriteriaAnalysis(filteredDeals), [filteredDeals])
  const summaryStats = useMemo(() => computeSummaryStats(filteredDeals), [filteredDeals])
  const farmerMatrix = useMemo(() => computeFarmerMatrix(filteredDeals), [filteredDeals])
  const macroKPIs = useMemo(() => computeMacroKPIs(filteredDeals, farmerMatrix), [filteredDeals, farmerMatrix])
  const insights = useMemo(() => generateInsights(filteredDeals, farmerMatrix), [filteredDeals, farmerMatrix])

  const activeTeamLabel = selectedTeam ? TEAMS[selectedTeam]?.label : null

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar onRefresh={handleRefresh} refreshing={refreshing} />

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
              <span className="text-orange-400 font-semibold">{validation.totalLiquido}</span>
            </span>
            <span className="text-slate-600 hidden sm:block">|</span>
            <span className="text-slate-500 text-xs">
              Atualizado às {format(lastUpdated, "HH:mm 'de' dd/MM", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* Fora do MOA breakdown */}
        {foraDoMOA.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-5 py-3">
            <div className="flex items-center gap-1.5 mr-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Fora do MOA</span>
            </div>
            {foraDoMOA.map(({ farmerName, count }) => (
              <span
                key={farmerName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)', color: '#fbbf24' }}
              >
                {farmerName}
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'rgba(217,119,6,0.25)', color: '#f59e0b', width: 18, height: 18 }}
                >
                  {count}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Team filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="team-filter" className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Time:
            </label>
            <div className="flex gap-1.5">
              {TEAM_OPTIONS.map((opt) => {
                const active = (selectedTeam ?? '') === opt.value
                return (
                  <button
                    key={opt.value}
                    id={opt.value === '' ? 'team-filter' : undefined}
                    onClick={() => setSelectedTeam(opt.value || null)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: active ? '#FF5200' : '#1e293b',
                      color: active ? '#fff' : '#94a3b8',
                      border: active ? '1px solid #FF5200' : '1px solid #334155',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-700 hidden sm:block" />

          {/* Month filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Período:
            </label>
            <select
              id="month-filter"
              value={selectedMonth ?? ''}
              onChange={(e) => setSelectedMonth(e.target.value || null)}
              className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-[#FF5200]"
            >
              <option value="">Todos os meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Active filter summary */}
          {(selectedTeam || selectedMonth) && (
            <span className="text-slate-400 text-sm">
              <span className="text-white font-medium">{filteredDeals.length}</span> negócios
              {activeTeamLabel ? ` · ${activeTeamLabel}` : ''}
              {selectedMonth ? ` · ${formatMonthLabel(selectedMonth)}` : ''}
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

        {/* ── INTELIGÊNCIA ─────────────────────────────── */}
        <div className="border-t border-slate-700/50 pt-8 space-y-6">
          <div>
            <h2 className="text-white font-bold text-xl">Inteligência de Pipeline</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Análise macro, pontos de atenção e insights automáticos
              {activeTeamLabel ? ` — ${activeTeamLabel}` : ''}
              {selectedMonth ? ` · ${formatMonthLabel(selectedMonth)}` : ''}.
            </p>
          </div>

          {/* KPIs macro */}
          <MacroKPIBar kpis={macroKPIs} />

          {/* Insights automáticos */}
          <div className="space-y-2">
            <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Insights automáticos</h3>
            <InsightList insights={insights} />
          </div>

          {/* Matriz Farmer × Critério */}
          <div className="space-y-2">
            <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wide">Matriz de qualificação por Farmer</h3>
            <FarmerMatrix matrix={farmerMatrix} />
          </div>
        </div>
      </main>
    </div>
  )
}
