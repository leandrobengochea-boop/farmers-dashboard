'use client'

import { FarmerMatrixRow } from '@/lib/insights'
import { CRITERIA } from '@/lib/constants'

function absenceColor(rate: number): string {
  if (rate === 0) return 'bg-green-900/60 text-green-300'
  if (rate <= 0.25) return 'bg-green-900/30 text-green-400'
  if (rate <= 0.5) return 'bg-yellow-900/40 text-yellow-300'
  if (rate <= 0.75) return 'bg-orange-900/40 text-orange-300'
  return 'bg-red-900/50 text-red-300'
}

function scoreColor(avg: number): string {
  if (avg >= 9) return 'text-green-400'
  if (avg >= 7) return 'text-yellow-400'
  return 'text-red-400'
}

interface FarmerMatrixProps {
  matrix: FarmerMatrixRow[]
}

export default function FarmerMatrix({ matrix }: FarmerMatrixProps) {
  if (matrix.length === 0) return null

  const shortLabel: Record<string, string> = {
    reuniao_agendada: 'Reunião',
    tempo_de_compra_45_dias: 'Tempo 45d',
    data_do_evento_ate_6_meses: 'Data evento',
    historico_de_contratacao: 'Histórico',
    qualificacao_completa: 'Qualif.',
    faixa_de_investimento_informada: 'Investim.',
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-white font-semibold text-base">Matriz Farmer × Critério Faltante</h3>
        <p className="text-slate-400 text-xs mt-0.5">% dos deals de cada farmer em que o critério está ausente</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium whitespace-nowrap">Farmer</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium whitespace-nowrap">Deals</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium whitespace-nowrap">Média</th>
              {CRITERIA.map((c) => (
                <th key={c.key} className="text-center py-3 px-2 text-slate-400 font-medium whitespace-nowrap">
                  <span title={c.label}>{shortLabel[c.key] ?? c.label}</span>
                  <span className="text-slate-600 font-normal"> ({c.weight}pt)</span>
                </th>
              ))}
              <th className="text-center py-3 px-3 text-slate-400 font-medium whitespace-nowrap">Parados</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.farmerId} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                <td className="py-3 px-4 text-slate-200 font-medium whitespace-nowrap">{row.farmerName}</td>
                <td className="py-3 px-3 text-center text-slate-400">{row.dealCount}</td>
                <td className={`py-3 px-3 text-center font-bold ${scoreColor(row.avgScore)}`}>
                  {row.avgScore.toFixed(1)}
                </td>
                {CRITERIA.map((c) => {
                  const rate = row.criteriaAbsenceRate[c.key] ?? 0
                  return (
                    <td key={c.key} className="py-3 px-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${absenceColor(rate)}`}>
                        {rate === 0 ? '—' : `${(rate * 100).toFixed(0)}%`}
                      </span>
                    </td>
                  )
                })}
                <td className="py-3 px-3 text-center">
                  {row.staleDealCount > 0 ? (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300 border border-red-800">
                      {row.staleDealCount}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="px-6 py-3 border-t border-slate-700 flex flex-wrap gap-4">
        {[
          { color: 'bg-green-900/60', label: '0%' },
          { color: 'bg-green-900/30', label: '1–25%' },
          { color: 'bg-yellow-900/40', label: '26–50%' },
          { color: 'bg-orange-900/40', label: '51–75%' },
          { color: 'bg-red-900/50', label: '76–100%' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${l.color}`} />
            <span className="text-slate-400 text-xs">{l.label} ausente</span>
          </div>
        ))}
      </div>
    </div>
  )
}
