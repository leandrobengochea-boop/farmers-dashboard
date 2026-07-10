'use client'

import { useState } from 'react'
import { FarmerStats } from '@/lib/analytics'
import { Deal } from '@/lib/hubspot'
import { CRITERIA } from '@/lib/constants'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FarmerRankingProps {
  data: FarmerStats[]
  deals: Deal[]
}

function getBarColor(avgScore: number): string {
  const s = Math.floor(avgScore)
  if (s <= 6)  return '#dc2626'  // vermelho
  if (s === 7) return '#FF5200'  // laranja PSA
  if (s === 8) return '#f97316'  // laranja
  if (s === 9) return '#eab308'  // amarelo
  if (s === 10) return '#86efac' // verde claro
  if (s === 11) return '#22c55e' // verde médio
  return '#15803d'               // verde escuro
}

function getScoreColor(score: number): string {
  if (score >= 9) return 'bg-green-900/50 text-green-300 border-green-700'
  if (score >= 7) return 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
  return 'bg-red-900/50 text-red-300 border-red-700'
}

interface FarmerModalProps {
  farmerName: string
  deals: Deal[]
  onClose: () => void
}

function FarmerModal({ farmerName, deals, onClose }: FarmerModalProps) {
  const sorted = [...deals].sort((a, b) => b.score - a.score)

  const missingFor = (deal: Deal) =>
    CRITERIA.filter((c) => !deal.criteria.includes(c.key))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div>
            <h3 className="text-white font-semibold text-lg">{farmerName}</h3>
            <p className="text-zinc-400 text-sm">{deals.length} negócios</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-zinc-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-sm">
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-3 px-4 font-medium">Negócio</th>
                <th className="text-left py-3 px-4 font-medium whitespace-nowrap">Data</th>
                <th className="text-left py-3 px-4 font-medium">Nota</th>
                <th className="text-left py-3 px-4 font-medium">Critérios faltantes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((deal) => {
                const missing = missingFor(deal)
                return (
                  <tr key={deal.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition">
                    <td className="py-3 px-4 max-w-[200px]">
                      <a
                        href={deal.hubspotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-200 font-medium hover:text-orange-400 transition truncate block"
                        title={deal.name}
                      >
                        {deal.name}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {deal.date ? format(new Date(deal.date), 'dd/MM', { locale: ptBR }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {deal.isScored ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${getScoreColor(deal.score)}`}>
                          {deal.score}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border bg-zinc-700/60 text-zinc-400 border-zinc-600">
                          Fora do SAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {missing.length === 0 ? (
                        <span className="text-green-500 text-xs font-medium">Completo</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {missing.map((c) => (
                            <span
                              key={c.key}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300 border border-red-800 whitespace-nowrap"
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function FarmerRanking({ data, deals }: FarmerRankingProps) {
  const [selectedFarmer, setSelectedFarmer] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'deals' | 'companies'>('deals')

  const sorted = [...data].sort((a, b) =>
    sortBy === 'deals' ? b.dealCount - a.dealCount : b.companyCount - a.companyCount,
  )

  // Escala compartilhada: as barras de negócios e empresas usam o mesmo
  // máximo para que os comprimentos sejam comparáveis entre si.
  const maxDeals = Math.max(...sorted.map((f) => f.dealCount), 1)

  const selectedFarmerDeals = selectedFarmer
    ? deals.filter((d) => d.farmerId === selectedFarmer)
    : []

  const selectedFarmerName =
    data.find((f) => f.farmerId === selectedFarmer)?.farmerName ?? ''

  return (
    <>
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-white font-semibold text-lg">Volume por Farmer</h2>
            <span className="text-zinc-500 text-xs">cor = nota média</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">ordenar:</span>
            <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden text-xs">
              <button
                onClick={() => setSortBy('deals')}
                className={`px-3 py-1.5 transition ${sortBy === 'deals' ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Negócios
              </button>
              <button
                onClick={() => setSortBy('companies')}
                className={`px-3 py-1.5 transition ${sortBy === 'companies' ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Empresas
              </button>
            </div>
          </div>
        </div>

        {/* Legenda das duas barras */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2.5 rounded-sm" style={{ background: '#f97316' }} />
            <span className="text-zinc-400">empresas únicas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2.5 rounded-sm" style={{ background: 'rgba(249,115,22,0.28)' }} />
            <span className="text-zinc-400">negócios repetidos (mesma empresa)</span>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-zinc-400">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((f) => {
              const color = getBarColor(f.avgScore)
              const dealsPct = (f.dealCount / maxDeals) * 100
              const companiesPct = (f.companyCount / maxDeals) * 100
              const repeated = f.dealCount - f.companyCount
              return (
                <button
                  key={f.farmerId}
                  onClick={() => setSelectedFarmer(f.farmerId)}
                  className="group flex items-center gap-3 w-full text-left hover:bg-zinc-700/30 rounded-lg px-2 py-1 -mx-2 transition"
                  title={`${f.farmerName}: ${f.dealCount} negócios · ${f.companyCount} empresas únicas${repeated > 0 ? ` · ${repeated} repetidos` : ''} · nota ${f.avgScore.toFixed(1)}`}
                >
                  <span className="w-28 flex-shrink-0 text-zinc-300 text-sm truncate">{f.farmerName}</span>

                  <div className="flex-1 min-w-0">
                    {/* Barra de negócios (faded) com empresas únicas (sólida) sobreposta */}
                    <div className="relative h-5 rounded bg-zinc-700/40">
                      <div
                        className="absolute left-0 top-0 h-full rounded transition-all"
                        style={{ width: `${dealsPct}%`, background: color, opacity: 0.28 }}
                      />
                      <div
                        className="absolute left-0 top-0 h-full rounded transition-all"
                        style={{ width: `${companiesPct}%`, background: color }}
                      />
                    </div>
                  </div>

                  {/* Números: empresas / negócios */}
                  <span className="flex-shrink-0 w-24 text-right text-xs tabular-nums">
                    <span className="text-white font-semibold">{f.companyCount}</span>
                    <span className="text-zinc-500"> / {f.dealCount}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-zinc-700">
          <span className="text-zinc-500 text-xs">Cor = nota média:</span>
          {[
            { color: '#dc2626', label: '≤6' },
            { color: '#FF5200', label: '7' },
            { color: '#f97316', label: '8' },
            { color: '#eab308', label: '9' },
            { color: '#86efac', label: '10' },
            { color: '#22c55e', label: '11' },
            { color: '#15803d', label: '12' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-zinc-400 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedFarmer && (
        <FarmerModal
          farmerName={selectedFarmerName}
          deals={selectedFarmerDeals}
          onClose={() => setSelectedFarmer(null)}
        />
      )}
    </>
  )
}
