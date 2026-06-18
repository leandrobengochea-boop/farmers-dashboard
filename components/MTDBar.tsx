'use client'

const MONTHLY_GOAL = 300

interface MTDBarProps {
  deals: { date: string }[]
  selectedTeam: string | null
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export default function MTDBar({ deals, selectedTeam: _ }: MTDBarProps) {
  const now = new Date()
  const monthKey = getCurrentMonthKey()
  const [year, month] = monthKey.split('-').map(Number)

  const totalDays = getDaysInMonth(year, month)
  const dayOfMonth = now.getDate()

  const monthDeals = deals.filter((d) => {
    if (!d.date) return false
    const date = new Date(d.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return key === monthKey
  })

  const count = monthDeals.length
  const paceTarget = Math.round((dayOfMonth / totalDays) * MONTHLY_GOAL)
  const pacePercent = (paceTarget / MONTHLY_GOAL) * 100
  const actualPercent = Math.min((count / MONTHLY_GOAL) * 100, 100)
  const diff = count - paceTarget

  const barColor = diff >= 0 ? '#22c55e' : diff >= -10 ? '#f97316' : '#dc2626'
  const diffColor = diff >= 0 ? '#22c55e' : '#ef4444'
  const diffLabel = diff >= 0 ? `+${diff} ↑` : `${diff} ↓`

  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ` ${year}`

  return (
    <div
      className="flex flex-col gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-5 py-3"
      title={`Meta mensal: ${MONTHLY_GOAL} demandas`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-slate-400 text-sm">{monthLabel}</span>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-slate-300 text-sm">
            <span className="text-white font-semibold" style={{ color: '#FF5200' }}>{count}</span>
            <span className="text-slate-500"> / {MONTHLY_GOAL} demandas</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right hidden sm:block">
            <span className="text-slate-500">Meta do dia </span>
            <span className="text-amber-400 font-medium">{paceTarget}</span>
            <span className="font-semibold ml-1" style={{ color: diffColor }}>{diffLabel}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Meta mês </span>
            <span className="text-slate-400 font-medium">{MONTHLY_GOAL}</span>
          </div>
        </div>
      </div>

      <div className="relative h-2 bg-slate-700 rounded-full overflow-visible">
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

      <div className="flex justify-between text-xs text-slate-600">
        <span>0</span>
        <span className="text-amber-600/70 text-[10px]">meta hoje</span>
        <span>{MONTHLY_GOAL}</span>
      </div>
    </div>
  )
}
