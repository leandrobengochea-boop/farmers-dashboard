'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Deal, FetchValidation, ExcludedDeal, ForaDoMOAEntry } from '@/lib/hubspot'
import { TEAMS } from '@/lib/constants'
import Navbar from './Navbar'
import SummaryCards from './SummaryCards'
import FarmerRanking from './FarmerRanking'
import ScoreDistribution from './ScoreDistribution'
import OpportunitiesByDay from './OpportunitiesByDay'
import DealsTable from './DealsTable'
import { MacroKPIBar, InsightList } from './insights/InsightCards'
import MTDBar from './MTDBar'
import MeetingConversionTable from './MeetingConversionTable'
import ForaDoMOABar from './ForaDoMOABar'
import FarmerMatrix from './insights/FarmerMatrix'
import {
  computeFarmerRanking,
  computeScoreDistribution,
  computeSummaryStats,
  computeForaDoMOA,
  computeMeetingConversion,
  computeOpportunitiesByDay,
  filterDealsByPeriod,
  filterDealsByTeam,
  periodToMonthKey,
  PERIOD_OPTIONS,
  PeriodKey,
} from '@/lib/analytics'
import {
  computeFarmerMatrix,
  computeMacroKPIs,
  generateInsights,
} from '@/lib/insights'

interface DashboardClientProps {
  initialDeals: Deal[]
  validation: FetchValidation
  excludedDeals: ExcludedDeal[]
  fetchError: string | null
}

const TEAM_OPTIONS = [
  { value: '', label: 'Todos os Farmers' },
  ...Object.entries(TEAMS).map(([key, t]) => ({ value: key, label: t.label })),
]

export default function DashboardClient({
  initialDeals,
  validation: initialValidation,
  excludedDeals: initialExcludedDeals,
  fetchError: initialError,
}: DashboardClientProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [validation, setValidation] = useState<FetchValidation>(initialValidation)
  const [excludedDeals, setExcludedDeals] = useState<ExcludedDeal[]>(initialExcludedDeals)
  const [fetchError, setFetchError] = useState<string | null>(initialError)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/deals?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { deals: Deal[]; validation: FetchValidation; excludedDeals: ExcludedDeal[] }
      setDeals(data.deals)
      setValidation(data.validation)
      setExcludedDeals(data.excludedDeals ?? [])
      setLastUpdated(new Date())
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erro ao atualizar dados')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const teamDeals = useMemo(() => filterDealsByTeam(deals, selectedTeam), [deals, selectedTeam])
  const filteredDeals = useMemo(
    () => filterDealsByPeriod(teamDeals, selectedPeriod, customDateRange),
    [teamDeals, selectedPeriod, customDateRange],
  )

  const selectedMonthKey = useMemo(() => periodToMonthKey(selectedPeriod), [selectedPeriod])

  const foraDoMOA: ForaDoMOAEntry[] = useMemo(
    () => computeForaDoMOA(excludedDeals, selectedTeam, selectedMonthKey),
    [excludedDeals, selectedTeam, selectedMonthKey],
  )

  const farmerRanking = useMemo(() => computeFarmerRanking(filteredDeals), [filteredDeals])
  const scoreDistribution = useMemo(() => computeScoreDistribution(filteredDeals), [filteredDeals])

  const chartMonthKey = useMemo(() => {
    if (selectedMonthKey) return selectedMonthKey
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [selectedMonthKey])
  const oppsByDay = useMemo(
    () => computeOpportunitiesByDay(teamDeals, chartMonthKey, 100),
    [teamDeals, chartMonthKey],
  )
  const chartMonthLabel = useMemo(() => {
    const [y, m] = chartMonthKey.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1) + ` ${y}`
  }, [chartMonthKey])
  const summaryStats = useMemo(() => computeSummaryStats(filteredDeals), [filteredDeals])
  const meetingConversion = useMemo(() => computeMeetingConversion(filteredDeals), [filteredDeals])
  const farmerMatrix = useMemo(() => computeFarmerMatrix(filteredDeals), [filteredDeals])
  const macroKPIs = useMemo(() => computeMacroKPIs(filteredDeals, farmerMatrix), [filteredDeals, farmerMatrix])
  const insights = useMemo(() => generateInsights(filteredDeals, farmerMatrix), [filteredDeals, farmerMatrix])

  const activeTeamLabel = selectedTeam ? TEAMS[selectedTeam]?.label : null

  return (
    <div className="min-h-screen bg-black">
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
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-zinc-800/60 border border-zinc-700 rounded-xl px-6 py-3 text-sm">
            <span className="text-zinc-400">
              Bruto: <span className="text-white font-medium">{validation.totalBruto}</span>
            </span>
            <span className="text-zinc-600 hidden sm:block">|</span>
            <span className="text-zinc-400">
              Excluídos (Fora do MOA):{' '}
              <span className={validation.excludedFora > 0 ? 'text-yellow-400 font-medium' : 'text-white font-medium'}>
                {validation.excludedFora}
              </span>
            </span>
            <span className="text-zinc-600 hidden sm:block">|</span>
            <span className="text-zinc-400">
              Total líquido:{' '}
              <span className="text-orange-400 font-semibold">{validation.totalLiquido}</span>
            </span>
            <span className="text-zinc-600 hidden sm:block">|</span>
            <span className="text-zinc-500 text-xs">
              Atualizado às {format(lastUpdated, "HH:mm 'de' dd/MM", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* MTD progress bar + composition (follows period filter) */}
        <MTDBar deals={teamDeals} filteredDeals={filteredDeals} selectedTeam={selectedTeam} hasPeriodFilter={selectedPeriod === 'entre' ? !!(customDateRange.start && customDateRange.end) : !!selectedPeriod} />

        {/* Fora do MOA breakdown */}
        {foraDoMOA.length > 0 && (
          <ForaDoMOABar foraDoMOA={foraDoMOA} excludedDeals={excludedDeals} selectedTeam={selectedTeam} selectedMonth={selectedMonthKey} />
        )}

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Team filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="team-filter" className="text-zinc-400 text-sm font-medium whitespace-nowrap">
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
          <div className="w-px h-6 bg-zinc-700 hidden sm:block" />

          {/* Period filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="period-filter" className="text-zinc-400 text-sm font-medium whitespace-nowrap">
              Período:
            </label>
            <select
              id="period-filter"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodKey)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-[#FF5200]"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedPeriod === 'entre' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange((r) => ({ ...r, start: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-[#FF5200]"
                />
                <span className="text-zinc-500 text-sm">até</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange((r) => ({ ...r, end: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-[#FF5200]"
                />
              </div>
            )}
          </div>

          {/* Active filter summary */}
          {(selectedTeam || selectedPeriod) && (
            <span className="text-zinc-400 text-sm">
              <span className="text-white font-medium">{filteredDeals.length}</span> negócios
              {activeTeamLabel ? ` · ${activeTeamLabel}` : ''}
              {selectedPeriod === 'entre' && customDateRange.start && customDateRange.end
                ? ` · ${customDateRange.start.split('-').reverse().join('/')} a ${customDateRange.end.split('-').reverse().join('/')}`
                : selectedPeriod ? ` · ${PERIOD_OPTIONS.find((o) => o.value === selectedPeriod)?.label}` : ''}
            </span>
          )}
        </div>

        {/* Summary Cards */}
        <SummaryCards stats={summaryStats} deals={filteredDeals} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FarmerRanking data={farmerRanking} deals={filteredDeals} />
          <div className="flex flex-col gap-6">
            <ScoreDistribution data={scoreDistribution} />
            {meetingConversion.length > 0 && (
              <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <polyline points="16 11 18 13 22 9"/>
                  </svg>
                  <h2 className="text-white font-semibold text-base">Conversão de reuniões por farmer</h2>
                </div>
                <div className="flex gap-4 mb-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-1.5 rounded-full bg-orange-500" />
                    % empresas com agendamento
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-1.5 rounded-full bg-green-500" />
                    % reuniões realizadas
                  </span>
                </div>
                <MeetingConversionTable data={meetingConversion} deals={filteredDeals} />
              </div>
            )}
          </div>
        </div>

        {/* Oportunidades por dia · por curador */}
        <OpportunitiesByDay data={oppsByDay} monthLabel={chartMonthLabel} />

        {/* Deals Table */}
        <DealsTable deals={filteredDeals} />

        {/* ── INTELIGÊNCIA ─────────────────────────────── */}
        <div className="border-t border-zinc-700/50 pt-8 space-y-6">
          <div>
            <h2 className="text-white font-bold text-xl">Inteligência de Pipeline</h2>
            <p className="text-zinc-400 text-sm mt-0.5">
              Análise macro, pontos de atenção e insights automáticos
              {activeTeamLabel ? ` — ${activeTeamLabel}` : ''}
              {selectedPeriod ? ` · ${PERIOD_OPTIONS.find((o) => o.value === selectedPeriod)?.label}` : ''}.
            </p>
          </div>

          {/* KPIs macro */}
          <MacroKPIBar kpis={macroKPIs} />

          {/* Insights automáticos */}
          <div className="space-y-2">
            <h3 className="text-zinc-300 font-semibold text-sm uppercase tracking-wide">Insights automáticos</h3>
            <InsightList insights={insights} />
          </div>

          {/* Matriz Farmer × Critério */}
          <div className="space-y-2">
            <h3 className="text-zinc-300 font-semibold text-sm uppercase tracking-wide">Matriz de qualificação por Farmer</h3>
            <FarmerMatrix matrix={farmerMatrix} />
          </div>
        </div>
      </main>
    </div>
  )
}
