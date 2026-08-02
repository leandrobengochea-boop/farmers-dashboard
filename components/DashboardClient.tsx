'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Deal, FetchValidation, ExcludedDeal, ForaDoMOAEntry } from '@/lib/hubspot'
import { TEAMS } from '@/lib/constants'
import Navbar from './Navbar'
import SummaryCards from './SummaryCards'
import FarmerTable from './FarmerTable'
import ScoreDistribution from './ScoreDistribution'
import OpportunitiesByDay from './OpportunitiesByDay'
import DealsTable from './DealsTable'
import { MacroKPIBar, InsightList } from './insights/InsightCards'
import MTDBar from './MTDBar'
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
  periodCoversWholeMonth,
  PERIOD_OPTIONS,
  PeriodKey,
} from '@/lib/analytics'
import {
  computeFarmerMatrix,
  computeMacroKPIs,
  generateInsights,
} from '@/lib/insights'
import { SHOW_ALL_SERIES } from '@/lib/viz'

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

  const selectedMonthKey = useMemo(
    () => periodToMonthKey(selectedPeriod, customDateRange),
    [selectedPeriod, customDateRange],
  )

  // Mês que o card de meta representa. Segue o filtro quando o período cabe
  // num mês só; caso contrário, mês corrente.
  const referenceMonthKey = useMemo(() => {
    if (selectedMonthKey) return selectedMonthKey
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [selectedMonthKey])

  const foraDoMOA: ForaDoMOAEntry[] = useMemo(
    () => computeForaDoMOA(excludedDeals, selectedTeam, selectedMonthKey),
    [excludedDeals, selectedTeam, selectedMonthKey],
  )

  const farmerRanking = useMemo(() => computeFarmerRanking(filteredDeals), [filteredDeals])
  const scoreDistribution = useMemo(() => computeScoreDistribution(filteredDeals), [filteredDeals])

  const oppsByDay = useMemo(
    () => computeOpportunitiesByDay(teamDeals, referenceMonthKey, SHOW_ALL_SERIES),
    [teamDeals, referenceMonthKey],
  )
  const chartMonthLabel = useMemo(() => {
    const [y, m] = referenceMonthKey.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1) + ` ${y}`
  }, [referenceMonthKey])
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

        {/* Freshness — metadado, fica discreto */}
        {validation.totalBruto > 0 && (
          <p className="text-zinc-600 text-xs text-right -mb-2">
            Atualizado às {format(lastUpdated, "HH:mm 'de' dd/MM", { locale: ptBR })}
          </p>
        )}

        {/* Meta mensal + composição — sempre um mês civil inteiro */}
        <MTDBar
          deals={teamDeals}
          selectedTeam={selectedTeam}
          referenceMonthKey={referenceMonthKey}
          ignoresPeriodFilter={!periodCoversWholeMonth(selectedPeriod, customDateRange)}
        />

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

        {/* Fora do MOA — lista de exceções do recorte atual */}
        {foraDoMOA.length > 0 && (
          <ForaDoMOABar foraDoMOA={foraDoMOA} excludedDeals={excludedDeals} selectedTeam={selectedTeam} selectedMonth={selectedMonthKey} />
        )}

        {/* Desempenho por farmer — volume, qualidade e conversão numa tabela só */}
        <FarmerTable
          ranking={farmerRanking}
          meetings={meetingConversion}
          matrix={farmerMatrix}
          deals={filteredDeals}
        />

        <ScoreDistribution data={scoreDistribution} />

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

        {/* Reconciliação — dado de auditoria, não de leitura diária */}
        {validation.totalBruto > 0 && (
          <footer className="border-t border-zinc-800 pt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
            <span>Bruto: <span className="text-zinc-500">{validation.totalBruto}</span></span>
            <span>·</span>
            <span>
              Excluídos (Fora do MOA):{' '}
              <span className={validation.excludedFora > 0 ? 'text-amber-600/80' : 'text-zinc-500'}>
                {validation.excludedFora}
              </span>
            </span>
            <span>·</span>
            <span>Total líquido: <span className="text-zinc-500">{validation.totalLiquido}</span></span>
          </footer>
        )}
      </main>
    </div>
  )
}
