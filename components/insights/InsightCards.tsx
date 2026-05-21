'use client'

import { Insight, MacroKPIs } from '@/lib/insights'

function pct(n: number) { return `${(n * 100).toFixed(0)}%` }
function round1(n: number) { return n.toFixed(1) }

interface MacroKPIBarProps { kpis: MacroKPIs }

export function MacroKPIBar({ kpis }: MacroKPIBarProps) {
  const cards = [
    {
      label: 'Qualificação completa',
      value: pct(kpis.fullyQualifiedRate),
      sub: 'deals com todos critérios',
      color: kpis.fullyQualifiedRate >= 0.5 ? 'text-green-400' : kpis.fullyQualifiedRate >= 0.25 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Eficiência de pontuação',
      value: pct(kpis.completionRate),
      sub: `do máximo possível (${12} pts)`,
      color: kpis.completionRate >= 0.75 ? 'text-green-400' : kpis.completionRate >= 0.6 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Deals parados +15d',
      value: String(kpis.staleCount),
      sub: `${kpis.criticalStaleCount} críticos (+30d)`,
      color: kpis.staleCount === 0 ? 'text-green-400' : kpis.staleCount <= 5 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Idade média',
      value: `${Math.round(kpis.avgDaysSinceQualification)}d`,
      sub: 'desde qualificação',
      color: kpis.avgDaysSinceQualification <= 30 ? 'text-green-400' : kpis.avgDaysSinceQualification <= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Farmers em risco',
      value: String(kpis.highRiskFarmers),
      sub: 'com média abaixo de 7',
      color: kpis.highRiskFarmers === 0 ? 'text-green-400' : kpis.highRiskFarmers <= 2 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Principal gargalo',
      value: '—',
      sub: kpis.mostMissingCriterion,
      color: 'text-orange-400',
      wide: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-medium mb-1">{c.label}</p>
          {c.value !== '—' && (
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          )}
          <p className={`text-xs mt-0.5 ${c.value === '—' ? `font-semibold text-sm ${c.color}` : 'text-slate-500'}`}>{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

const INSIGHT_STYLES = {
  critical: {
    border: 'border-red-800',
    bg: 'bg-red-900/20',
    dot: 'bg-red-500',
    label: 'text-red-400',
    text: 'Crítico',
  },
  warning: {
    border: 'border-yellow-800',
    bg: 'bg-yellow-900/20',
    dot: 'bg-yellow-500',
    label: 'text-yellow-400',
    text: 'Atenção',
  },
  info: {
    border: 'border-blue-800',
    bg: 'bg-blue-900/20',
    dot: 'bg-blue-500',
    label: 'text-blue-400',
    text: 'Informação',
  },
  positive: {
    border: 'border-green-800',
    bg: 'bg-green-900/20',
    dot: 'bg-green-500',
    label: 'text-green-400',
    text: 'Positivo',
  },
}

interface InsightListProps { insights: Insight[] }

export function InsightList({ insights }: InsightListProps) {
  if (insights.length === 0) return null

  const order = ['critical', 'warning', 'info', 'positive']
  const sorted = [...insights].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
  )

  return (
    <div className="space-y-3">
      {sorted.map((insight, i) => {
        const s = INSIGHT_STYLES[insight.type]
        return (
          <div key={i} className={`border ${s.border} ${s.bg} rounded-xl px-5 py-4`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full ${s.dot} mt-1.5 flex-shrink-0`} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${s.label}`}>
                    {s.text}
                  </span>
                </div>
                <p className="text-white font-semibold text-sm">{insight.title}</p>
                <p className="text-slate-400 text-sm mt-0.5 leading-relaxed">{insight.detail}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
