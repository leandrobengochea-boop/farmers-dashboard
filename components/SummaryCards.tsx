import { SummaryStats } from '@/lib/analytics'

const ICONS = {
  deals: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  score: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  efficiency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  farmers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
}

function Card({
  title,
  value,
  subtitle,
  icon,
  highlight,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`relative bg-slate-800 rounded-xl p-5 border overflow-hidden ${highlight ? 'border-[#FF5200]/40' : 'border-slate-700'}`}>
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: highlight ? '#FF5200' : '#334155' }}
      />

      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <span className={`${highlight ? 'text-[#FF5200]' : 'text-slate-500'}`}>
          {icon}
        </span>
      </div>

      <p className="text-white font-bold mb-1" style={{ fontSize: '2rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>

      {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

const ICON_MEETING = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <polyline points="16 11 18 13 22 9"/>
  </svg>
)

export default function SummaryCards({ stats }: SummaryCardsProps) {
  const meetingRate = stats.meetingScheduled > 0
    ? Math.round((stats.meetingCompleted / stats.meetingScheduled) * 100)
    : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <Card
        title="Total de Negócios"
        value={stats.totalDeals.toLocaleString('pt-BR')}
        subtitle="negócios com pontuação"
        icon={ICONS.deals}
      />
      <Card
        title="Média de Pontuação"
        value={`${stats.avgScore.toFixed(1)} / 12`}
        subtitle="pontuação média geral"
        icon={ICONS.score}
        highlight
      />
      <Card
        title="Eficiência"
        value={`${stats.efficiency.toFixed(1)}%`}
        subtitle={`${stats.totalActualPoints.toLocaleString('pt-BR')} / ${stats.totalPossiblePoints.toLocaleString('pt-BR')} pontos`}
        icon={ICONS.efficiency}
      />
      <Card
        title="Farmers Ativos"
        value={stats.activeFarmers.toString()}
        subtitle="com ao menos 1 negócio"
        icon={ICONS.farmers}
      />
      <Card
        title="Reuniões"
        value={meetingRate !== null ? `${meetingRate}%` : '—'}
        subtitle={`${stats.meetingCompleted} realizadas / ${stats.meetingScheduled} agendadas`}
        icon={ICON_MEETING}
      />
    </div>
  )
}

interface SummaryCardsProps {
  stats: SummaryStats
}
