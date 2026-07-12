'use client'

import { useState, useMemo } from 'react'
import { uniqueDemandKey, isB2CCloser } from '@/lib/constants'

const GOAL_TOTAL = 336
const GOAL_TEAM  = 112

interface MTDDeal {
  date: string
  companyId: string
  id: string
  pipeline: string
  origemDoLead: string
  ownerName: string
}

interface MTDBarProps {
  deals: MTDDeal[]
  selectedTeam: string | null
}

function uniqueCompanies(deals: { companyId: string; id: string; pipeline: string }[]): number {
  return new Set(deals.map((d) => uniqueDemandKey(d))).size
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getTodayKey() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function businessDaysInRange(year: number, month: number, fromDay: number, toDay: number) {
  let count = 0
  for (let d = fromDay; d <= toDay; d++) {
    const wd = new Date(year, month - 1, d).getDay()
    if (wd !== 0 && wd !== 6) count++
  }
  return count
}

function formatDayKey(isoKey: string) {
  const [, m, d] = isoKey.split('-')
  return `${d}/${m}`
}

function getWeekdayAbbr(isoKey: string) {
  const date = new Date(`${isoKey}T12:00:00Z`)
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

function CompRing({ pct, color }: { pct: number; color: string }) {
  const r = 15.5
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="40" height="40" viewBox="0 0 36 36" className="flex-shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#3f3f46" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 18 18)"
      />
      <text x="18" y="19.5" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">
        {pct}%
      </text>
    </svg>
  )
}

export default function MTDBar({ deals, selectedTeam }: MTDBarProps) {
  const MONTHLY_GOAL = selectedTeam ? GOAL_TEAM : GOAL_TOTAL
  const now = new Date()
  const monthKey = getCurrentMonthKey()
  const todayKey = getTodayKey()
  const [year, month] = monthKey.split('-').map(Number)

  const totalDays = getDaysInMonth(year, month)
  const dayOfMonth = now.getDate()

  const dealDaysInMonth = useMemo(() => {
    const days = new Set<string>()
    for (const d of deals) {
      if (!d.date) continue
      const key = d.date.slice(0, 10)
      if (key <= todayKey && key.startsWith(monthKey)) days.add(key)
    }
    days.add(todayKey)
    return Array.from(days).sort()
  }, [deals, todayKey, monthKey])

  const [selectedDayKey, setSelectedDayKey] = useState<string>(todayKey)
  const isToday = selectedDayKey === todayKey

  function prevDay() {
    const current = new Date(`${selectedDayKey}T12:00:00Z`)
    current.setUTCDate(current.getUTCDate() - 1)
    const prev = current.toISOString().slice(0, 10)
    if (prev >= `${monthKey}-01`) setSelectedDayKey(prev)
  }

  function nextDay() {
    if (isToday) return
    const current = new Date(`${selectedDayKey}T12:00:00Z`)
    current.setUTCDate(current.getUTCDate() + 1)
    const next = current.toISOString().slice(0, 10)
    if (next <= todayKey) setSelectedDayKey(next)
  }

  const canGoPrev = selectedDayKey > `${monthKey}-01`
  const canGoNext = !isToday

  const monthDeals = deals.filter((d) => {
    if (!d.date) return false
    const key = `${new Date(d.date).getFullYear()}-${String(new Date(d.date).getMonth() + 1).padStart(2, '0')}`
    return key === monthKey
  })

  const selectedDayDeals = deals.filter((d) => {
    if (!d.date) return false
    return d.date.slice(0, 10) === selectedDayKey
  })

  const count = uniqueCompanies(monthDeals)
  const selectedDayCount = uniqueCompanies(selectedDayDeals)
  const totalBusinessDays = businessDaysInRange(year, month, 1, totalDays)
  const businessDaysElapsed = businessDaysInRange(year, month, 1, dayOfMonth)
  const paceTarget = totalBusinessDays > 0
    ? Math.round((businessDaysElapsed / totalBusinessDays) * MONTHLY_GOAL)
    : 0
  const pacePercent = (paceTarget / MONTHLY_GOAL) * 100
  const actualPercent = Math.min((count / MONTHLY_GOAL) * 100, 100)
  const diff = count - paceTarget

  const barColor = diff >= 0 ? '#22c55e' : diff >= -10 ? '#f97316' : '#dc2626'
  const diffColor = diff >= 0 ? '#22c55e' : '#ef4444'
  const diffLabel = diff >= 0 ? `+${diff} ↑` : `${diff} ↓`

  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ` ${year}`

  // Composition: Carteira + Ação de CRM + B2C
  const crmCount = monthDeals.filter((d) => d.origemDoLead === 'Ação de CRM').length
  const carteiraCount = monthDeals.filter((d) => d.origemDoLead === 'Carteira do Farmer').length
  const b2cCount = monthDeals.filter((d) => d.ownerName && isB2CCloser(d.ownerName)).length
  const totalMonth = monthDeals.length
  const carteiraPct = totalMonth > 0 ? Math.round((carteiraCount / totalMonth) * 100) : 0
  const crmPct = totalMonth > 0 ? Math.round((crmCount / totalMonth) * 100) : 0
  const b2cPct = totalMonth > 0 ? Math.round((b2cCount / totalMonth) * 100) : 0

  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-5 py-4">
      <div className="flex items-center gap-4 mb-3">

        {/* Card do dia com navegação */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-2 py-2"
          style={{ background: 'rgba(255,82,0,0.12)', border: '1px solid rgba(255,82,0,0.3)', minWidth: 110 }}
        >
          <div className="flex items-center justify-between w-full gap-1 mb-1">
            <button
              onClick={prevDay}
              disabled={!canGoPrev}
              className="flex items-center justify-center rounded w-5 h-5 transition"
              style={{ color: canGoPrev ? '#94a3b8' : 'rgba(113,113,122,0.25)', background: 'transparent', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', fontSize: 16, lineHeight: 1, padding: 0 }}
              aria-label="Dia anterior"
            >
              ‹
            </button>

            <div className="flex items-center justify-center flex-1">
              {isToday ? (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,82,0,0.2)', color: '#FF5200', border: '1px solid rgba(255,82,0,0.3)' }}
                >
                  Hoje
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500">
                  {getWeekdayAbbr(selectedDayKey)}
                </span>
              )}
            </div>

            <button
              onClick={nextDay}
              disabled={!canGoNext}
              className="flex items-center justify-center rounded w-5 h-5 transition"
              style={{ color: canGoNext ? '#94a3b8' : 'rgba(113,113,122,0.25)', background: 'transparent', border: 'none', cursor: canGoNext ? 'pointer' : 'default', fontSize: 16, lineHeight: 1, padding: 0 }}
              aria-label="Próximo dia"
            >
              ›
            </button>
          </div>

          <span className="text-3xl font-bold leading-none" style={{ color: '#FF5200' }} title="Empresas únicas no dia">
            {selectedDayCount}
          </span>

          <span className="text-[10px] text-zinc-500 mt-1">{formatDayKey(selectedDayKey)} · empresas</span>
        </div>

        {/* Separador */}
        <div className="w-px h-10 bg-zinc-700 flex-shrink-0" />

        {/* MTD + barra */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-zinc-400 text-sm">{monthLabel}</span>
              <span className="text-zinc-600 hidden sm:inline">·</span>
              <span className="text-zinc-300 text-sm font-medium">{count}</span>
              <span className="text-zinc-500 text-sm">/ {MONTHLY_GOAL}</span>
              <span className="text-zinc-600 text-xs hidden sm:inline">empresas únicas</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500 hidden sm:inline">
                Meta do dia <span className="text-amber-400 font-medium">{paceTarget}</span>
                <span className="font-semibold ml-1" style={{ color: diffColor }}>{diffLabel}</span>
              </span>
            </div>
          </div>

          <div className="relative h-2 bg-zinc-700 rounded-full overflow-visible">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${actualPercent}%`, background: barColor }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-sm bg-amber-400"
              style={{ left: `${Math.min(pacePercent, 99.5)}%` }}
              title={`Meta do dia: ${paceTarget}`}
            />
          </div>

          <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
            <span>0</span>
            <span className="text-amber-600/60">meta hoje</span>
            <span>{MONTHLY_GOAL}</span>
          </div>
        </div>
      </div>

      {/* Composição da demanda */}
      <div className="flex gap-3 mt-1">
        <div className="flex-1 flex items-center gap-3 bg-zinc-700/40 border border-zinc-700 rounded-lg px-3 py-2.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#22c55e' }} />
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-zinc-500 font-medium">Carteira do Farmer</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white leading-none">{carteiraCount}</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                {carteiraPct}%
              </span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">base própria</div>
          </div>
          <CompRing pct={carteiraPct} color="#22c55e" />
        </div>

        <div className="flex-1 flex items-center gap-3 bg-zinc-700/40 border border-zinc-700 rounded-lg px-3 py-2.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#FF5200' }} />
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,82,0,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-zinc-500 font-medium">Ação de CRM</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white leading-none">{crmCount}</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,82,0,0.15)', color: '#FF5200' }}>
                {crmPct}%
              </span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">prospecção ativa</div>
          </div>
          <CompRing pct={crmPct} color="#FF5200" />
        </div>

        <div className="flex-1 flex items-center gap-3 bg-zinc-700/40 border border-zinc-700 rounded-lg px-3 py-2.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#6366f1' }} />
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-zinc-500 font-medium">Convertido B2C</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white leading-none">{b2cCount}</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                {b2cPct}%
              </span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">closer B2C atribuído</div>
          </div>
          <CompRing pct={b2cPct} color="#6366f1" />
        </div>
      </div>
    </div>
  )
}
