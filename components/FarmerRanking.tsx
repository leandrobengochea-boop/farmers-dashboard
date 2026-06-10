'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
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

interface TooltipPayload {
  value: number
  payload: { farmerName: string; dealCount: number; avgScore: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-white font-semibold">{data.farmerName}</p>
      <p className="text-slate-300 text-sm">
        Média: <span className="text-white font-medium">{data.avgScore.toFixed(2)}</span>
      </p>
      <p className="text-slate-300 text-sm">
        Negócios: <span className="text-white font-medium">{data.dealCount}</span>
      </p>
      <p className="text-indigo-400 text-xs mt-1">Clique para ver detalhes</p>
    </div>
  )
}

function CustomYAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x === undefined || y === undefined || !payload) return null
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#94a3b8" fontSize={12}>
      {payload.value}
    </text>
  )
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
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-white font-semibold text-lg">{farmerName}</h3>
            <p className="text-slate-400 text-sm">{deals.length} negócios</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm">
              <tr className="text-slate-400 border-b border-slate-700">
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
                  <tr key={deal.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4 max-w-[200px]">
                      <a
                        href={deal.hubspotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-200 font-medium hover:text-indigo-400 transition truncate block"
                        title={deal.name}
                      >
                        {deal.name}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {deal.date ? format(new Date(deal.date), 'dd/MM', { locale: ptBR }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${getScoreColor(deal.score)}`}>
                        {deal.score}
                      </span>
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

  const chartData = data.map((f) => ({
    name: `${f.farmerName} (${f.dealCount})`,
    farmerName: f.farmerName,
    farmerId: f.farmerId,
    avgScore: parseFloat(f.avgScore.toFixed(2)),
    dealCount: f.dealCount,
  }))

  const chartHeight = Math.max(300, chartData.length * 40)

  const selectedFarmerDeals = selectedFarmer
    ? deals.filter((d) => d.farmerId === selectedFarmer)
    : []

  const selectedFarmerName =
    data.find((f) => f.farmerId === selectedFarmer)?.farmerName ?? ''

  function handleBarClick(entry: { farmerId: string }) {
    setSelectedFarmer(entry.farmerId)
  }

  return (
    <>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-white font-semibold text-lg mb-6">Ranking de Farmers</h2>

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
              onClick={(e) => {
                if (e?.activePayload?.[0]?.payload) {
                  handleBarClick(e.activePayload[0].payload)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 12]}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={<CustomYAxisTick />}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="avgScore" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.avgScore)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400 text-xs">Excelente (9+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-slate-400 text-xs">Bom (7–9)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-400 text-xs">Abaixo (7)</span>
          </div>
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
