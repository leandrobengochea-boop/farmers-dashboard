import { SummaryStats } from '@/lib/analytics'

interface SummaryCardsProps {
  stats: SummaryStats
}

function Card({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
      <p className="text-white text-3xl font-bold mb-1">{value}</p>
      {subtitle && <p className="text-slate-500 text-xs">{subtitle}</p>}
    </div>
  )
}

export default function SummaryCards({ stats }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        title="Total de Negócios"
        value={stats.totalDeals.toLocaleString('pt-BR')}
        subtitle="negócios com pontuação"
      />
      <Card
        title="Média de Pontuação"
        value={`${stats.avgScore.toFixed(1)} / 12`}
        subtitle="pontuação média geral"
      />
      <Card
        title="Eficiência"
        value={`${stats.efficiency.toFixed(1)}%`}
        subtitle={`${stats.totalActualPoints.toLocaleString('pt-BR')} / ${stats.totalPossiblePoints.toLocaleString('pt-BR')} pontos`}
      />
      <Card
        title="Farmers Ativos"
        value={stats.activeFarmers.toString()}
        subtitle="com ao menos 1 negócio"
      />
    </div>
  )
}
