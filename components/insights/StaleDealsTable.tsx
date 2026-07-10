'use client'

import { StaleDeal } from '@/lib/insights'

function stalenessColor(days: number) {
  if (days >= 30) return 'text-red-400 bg-red-900/30 border-red-800'
  if (days >= 15) return 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
  return 'text-zinc-400 bg-zinc-700/30 border-zinc-600'
}

function scoreColor(score: number) {
  if (score >= 9) return 'text-green-400'
  if (score >= 7) return 'text-yellow-400'
  return 'text-red-400'
}

interface StaleDealsTableProps {
  deals: StaleDeal[]
}

export default function StaleDealsTable({ deals }: StaleDealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <p className="text-zinc-300 text-sm">Nenhum negócio parado há mais de 15 dias.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-base">Deals sem movimentação</h3>
          <p className="text-zinc-400 text-xs mt-0.5">Negócios sem atualização há 15+ dias — risco de perda silenciosa</p>
        </div>
        <span className="text-red-400 font-semibold text-sm">{deals.length} deals</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900/50 border-b border-zinc-700 text-zinc-400">
              <th className="text-left py-3 px-4 font-medium">Negócio</th>
              <th className="text-left py-3 px-4 font-medium">Farmer</th>
              <th className="text-center py-3 px-4 font-medium whitespace-nowrap">Sem update</th>
              <th className="text-center py-3 px-4 font-medium whitespace-nowrap">Desde qualif.</th>
              <th className="text-center py-3 px-4 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20 transition">
                <td className="py-3 px-4">
                  <a
                    href={deal.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-200 font-medium hover:text-orange-400 transition truncate block max-w-xs"
                    title={deal.name}
                  >
                    {deal.name}
                  </a>
                </td>
                <td className="py-3 px-4 text-zinc-300">{deal.farmerName}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${stalenessColor(deal.daysSinceModified)}`}>
                    {deal.daysSinceModified >= 0 ? `${deal.daysSinceModified}d` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-zinc-400 text-xs">
                  {deal.daysSinceQualification >= 0 ? `${deal.daysSinceQualification}d` : '—'}
                </td>
                <td className={`py-3 px-4 text-center font-bold ${scoreColor(deal.score)}`}>
                  {deal.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
