'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { OppsByDayResult } from '@/lib/analytics'

interface Props {
  data: OppsByDayResult
  monthLabel: string
}

const PALETTE = ['#FF5200', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#14b8a6']
const OUTROS_COLOR = '#64748b'

function colorFor(name: string, index: number): string {
  if (name === 'Outros') return OUTROS_COLOR
  return PALETTE[index % PALETTE.length]
}

interface TooltipEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  const visible = payload.filter((p) => p.value > 0)
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  if (total === 0) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-300 font-medium mb-1.5">Dia {label}</p>
      {visible.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-300">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="text-white font-semibold">{p.value}</span>
        </p>
      ))}
      <p className="text-slate-400 mt-1.5 pt-1.5 border-t border-slate-700">
        Total: <span className="text-white font-semibold">{total}</span>
      </p>
    </div>
  )
}

export default function OpportunitiesByDay({ data, monthLabel }: Props) {
  const { owners, rows, grandTotal } = data

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h2 className="text-white font-semibold text-lg">Oportunidades por dia</h2>
          <span className="text-slate-500 text-xs">por farmer · {monthLabel}</span>
        </div>
        <span className="text-slate-400 text-sm">
          <span className="text-white font-semibold">{grandTotal}</span> no mês
        </span>
      </div>

      {/* Legenda com totais */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs">
        {owners.map((o, i) => (
          <span key={o.name} className="flex items-center gap-1.5 text-slate-400">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colorFor(o.name, i) }} />
            {o.name} <span className="text-slate-200 font-medium">{o.total}</span>
          </span>
        ))}
      </div>

      {grandTotal === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          Nenhuma oportunidade no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval={0}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {owners.map((o, i) => (
              <Bar
                key={o.name}
                dataKey={o.name}
                stackId="opps"
                fill={colorFor(o.name, i)}
                radius={i === owners.length - 1 ? [3, 3, 0, 0] : undefined}
                maxBarSize={36}
              >
                {i === owners.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    fill="#cbd5e1"
                    fontSize={11}
                    fontWeight={500}
                    formatter={(v: number) => (v > 0 ? v : '')}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
