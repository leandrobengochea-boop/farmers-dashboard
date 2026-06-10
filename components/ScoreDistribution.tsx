'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ScoreDistributionItem } from '@/lib/analytics'

function scoreColor(score: number): string {
  if (score <= 5) return '#ef4444'   // red — rejeitado
  if (score <= 7) return '#f97316'   // orange — limiar
  if (score <= 8) return '#FF5200'   // PSA orange — condicional
  if (score <= 10) return '#22c55e'  // green — qualificado
  return '#16a34a'                    // dark green — excelente
}

interface ScoreDistributionProps {
  data: ScoreDistributionItem[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-white font-semibold">Pontuação: {label}</p>
      <p className="text-slate-300 text-sm">
        Negócios: <span className="text-white font-medium">{payload[0].value}</span>
      </p>
    </div>
  )
}

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <h2 className="text-white font-semibold text-lg mb-6">Distribuição de Pontuações</h2>

      {data.every((d) => d.count === 0) ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          Nenhum dado disponível
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="score"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              label={{ value: 'Pontuação', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,82,0,0.08)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.map((entry) => (
                <Cell key={`cell-${entry.score}`} fill={scoreColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
