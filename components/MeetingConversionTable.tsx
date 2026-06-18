'use client'

import { FarmerMeetingStats } from '@/lib/analytics'

interface Props {
  data: FarmerMeetingStats[]
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-8 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}

export default function MeetingConversionTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Nenhum agendamento registrado
      </div>
    )
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-slate-800 z-10">
          <tr className="text-slate-500 text-xs uppercase tracking-wider">
            <th className="text-left py-2 px-3 font-medium">Farmer</th>
            <th className="text-right py-2 px-3 font-medium whitespace-nowrap">Neg.</th>
            <th className="py-2 px-3 font-medium min-w-[110px]">Agendadas</th>
            <th className="py-2 px-3 font-medium min-w-[110px]">Realizadas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((f) => (
            <tr
              key={f.farmerId}
              className="border-t border-slate-700/50 hover:bg-slate-700/20 transition"
            >
              <td className="py-2 px-3 text-slate-300 font-medium whitespace-nowrap">{f.farmerName}</td>
              <td className="py-2 px-3 text-slate-500 text-right tabular-nums">{f.totalDeals}</td>
              <td className="py-2 px-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-500">{f.scheduled} de {f.totalDeals}</span>
                  <MiniBar pct={f.scheduledPct} color="#f97316" />
                </div>
              </td>
              <td className="py-2 px-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-500">{f.completed} de {f.scheduled}</span>
                  <MiniBar pct={f.completedPct} color="#22c55e" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
