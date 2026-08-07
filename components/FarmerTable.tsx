'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FarmerStats, FarmerMeetingStats } from '@/lib/analytics'
import { FarmerMatrixRow } from '@/lib/insights'
import { Deal } from '@/lib/hubspot'
import { CRITERIA } from '@/lib/constants'
import { scoreScaleColor, SCORE_SCALE } from '@/lib/viz'

interface FarmerTableProps {
  ranking: FarmerStats[]
  meetings: FarmerMeetingStats[]
  matrix: FarmerMatrixRow[]
  deals: Deal[]
}

// Uma linha por farmer, reunindo o que antes estava espalhado em três
// recortes separados (volume, conversão de reuniões e deals parados). Cada
// recorte tinha sua própria ordenação, então comparar um farmer entre eles
// exigia reconciliação mental. Aqui qualquer coluna ordena a mesma lista.
interface Row {
  farmerId: string
  farmerName: string
  dealCount: number
  companyCount: number
  avgScore: number
  scheduled: number
  scheduledPct: number
  completed: number
  completedPct: number
  staleCount: number
}

type SortKey = keyof Omit<Row, 'farmerId'>
type SortDir = 'asc' | 'desc'

function getScoreColor(score: number): string {
  if (score >= 9) return 'bg-green-900/50 text-green-300 border-green-700'
  if (score >= 7) return 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
  return 'bg-red-900/50 text-red-300 border-red-700'
}

function FarmerModal({
  farmerName, deals, onClose,
}: { farmerName: string; deals: Deal[]; onClose: () => void }) {
  const sorted = [...deals].sort((a, b) => b.score - a.score)
  const missingFor = (deal: Deal) => CRITERIA.filter((c) => !deal.criteria.includes(c.key))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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

function PctCell({ pct, of, total }: { pct: number; of: number; total: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden xl:block w-14 h-1.5 rounded-full bg-zinc-700/60 overflow-hidden">
        <div className="h-full rounded-full bg-zinc-400" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-zinc-200 tabular-nums w-9 text-right">{pct}%</span>
      <span className="text-zinc-600 text-[11px] tabular-nums w-12 text-right">{of}/{total}</span>
    </div>
  )
}

type ModalFilter = 'all' | 'scheduled' | 'completed'

export default function FarmerTable({ ranking, meetings, matrix, deals }: FarmerTableProps) {
  const [selectedFarmer, setSelectedFarmer] = useState<string | null>(null)
  const [modalFilter, setModalFilter] = useState<ModalFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('dealCount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows: Row[] = useMemo(() => {
    const byMeeting = new Map(meetings.map((m) => [m.farmerId, m]))
    const byMatrix = new Map(matrix.map((m) => [m.farmerId, m]))
    return ranking.map((f) => {
      const m = byMeeting.get(f.farmerId)
      return {
        farmerId: f.farmerId,
        farmerName: f.farmerName,
        dealCount: f.dealCount,
        companyCount: f.companyCount,
        avgScore: f.avgScore,
        scheduled: m?.scheduled ?? 0,
        scheduledPct: m?.scheduledPct ?? 0,
        completed: m?.completed ?? 0,
        completedPct: m?.completedPct ?? 0,
        staleCount: byMatrix.get(f.farmerId)?.staleDealCount ?? 0,
      }
    })
  }, [ranking, meetings, matrix])

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sortKey, sortDir])

  const maxDeals = Math.max(...rows.map((r) => r.dealCount), 1)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Nome começa A→Z; métricas começam do maior.
      setSortDir(key === 'farmerName' ? 'asc' : 'desc')
    }
  }

  function Th({
    label, sortKey: key, align = 'right', title,
  }: { label: string; sortKey: SortKey; align?: 'left' | 'right'; title?: string }) {
    const active = sortKey === key
    return (
      <th className={`py-2 px-3 font-medium ${align === 'left' ? 'text-left' : 'text-right'}`}>
        <button
          onClick={() => handleSort(key)}
          title={title}
          className={`inline-flex items-center gap-1 transition hover:text-zinc-200 ${active ? 'text-orange-400' : 'text-zinc-400'}`}
        >
          {align === 'right' && active && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          {label}
          {align === 'left' && active && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
        </button>
      </th>
    )
  }

  const selectedDeals = selectedFarmer
    ? deals.filter((d) => {
        if (d.farmerId !== selectedFarmer) return false
        if (modalFilter === 'scheduled') return d.meetingScheduled
        if (modalFilter === 'completed') return d.meetingCompleted
        return true
      })
    : []
  const selectedName = rows.find((r) => r.farmerId === selectedFarmer)?.farmerName ?? ''
  const modalTitle = modalFilter === 'scheduled'
    ? `${selectedName} — Reuniões agendadas`
    : modalFilter === 'completed'
      ? `${selectedName} — Reuniões realizadas`
      : selectedName

  return (
    <>
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-baseline justify-between gap-2 mb-1 flex-wrap">
          <h2 className="text-white font-semibold text-lg">Desempenho por Farmer</h2>
          <span className="text-zinc-500 text-xs">clique no cabeçalho para ordenar · na linha para ver os negócios</span>
        </div>
        <p className="text-zinc-500 text-xs mb-4">
          Volume, qualidade e conversão na mesma linha — ordenável por qualquer coluna.
        </p>

        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-400">Nenhum dado disponível</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/40 text-zinc-400 border-b border-zinc-700">
                  <Th label="Farmer" sortKey="farmerName" align="left" />
                  <th className="py-2 px-3 font-medium text-left w-28">Volume</th>
                  <Th label="Empresas" sortKey="companyCount" title="Empresas únicas — é o que conta para a meta" />
                  <Th label="Negócios" sortKey="dealCount" title="Total de oportunidades, incluindo repetidas da mesma empresa" />
                  <Th label="Nota" sortKey="avgScore" title="Nota média das oportunidades pontuadas" />
                  <Th label="Agendadas" sortKey="scheduledPct" title="% das empresas com ao menos uma reunião agendada" />
                  <Th label="Realizadas" sortKey="completedPct" title="% das empresas únicas com reunião realizada — mesma base de Agendadas" />
                  <Th label="Parados" sortKey="staleCount" title="Negócios sem atualização há mais de 15 dias" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const color = scoreScaleColor(r.avgScore)
                  const repeated = r.dealCount - r.companyCount
                  return (
                    <tr
                      key={r.farmerId}
                      onClick={() => { setModalFilter('all'); setSelectedFarmer(r.farmerId) }}
                      className="border-b border-zinc-700/40 hover:bg-zinc-700/30 transition cursor-pointer"
                    >
                      <td className="py-2.5 px-3 text-zinc-200 whitespace-nowrap max-w-[10rem] truncate" title={r.farmerName}>
                        {r.farmerName}
                      </td>

                      {/* Barra: empresas únicas sólido, repetidos esmaecido */}
                      <td className="py-2.5 px-3">
                        <div
                          className="relative h-2.5 rounded bg-zinc-700/40 w-24"
                          title={`${r.companyCount} empresas${repeated > 0 ? ` · ${repeated} repetidos` : ''}`}
                        >
                          <div
                            className="absolute left-0 top-0 h-full rounded"
                            style={{ width: `${(r.dealCount / maxDeals) * 100}%`, background: color, opacity: 0.28 }}
                          />
                          <div
                            className="absolute left-0 top-0 h-full rounded"
                            style={{ width: `${(r.companyCount / maxDeals) * 100}%`, background: color }}
                          />
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right text-white font-semibold tabular-nums">{r.companyCount}</td>
                      <td className="py-2.5 px-3 text-right text-zinc-400 tabular-nums">{r.dealCount}</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums" style={{ color }}>
                        {r.avgScore.toFixed(1)}
                      </td>
                      <td
                        className="py-2.5 px-3 cursor-pointer hover:bg-zinc-600/30 rounded transition"
                        onClick={(e) => { e.stopPropagation(); setModalFilter('scheduled'); setSelectedFarmer(r.farmerId) }}
                      >
                        <PctCell pct={r.scheduledPct} of={r.scheduled} total={r.companyCount} />
                      </td>
                      <td
                        className="py-2.5 px-3 cursor-pointer hover:bg-zinc-600/30 rounded transition"
                        onClick={(e) => { e.stopPropagation(); setModalFilter('completed'); setSelectedFarmer(r.farmerId) }}
                      >
                        <PctCell pct={r.completedPct} of={r.completed} total={r.companyCount} />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {r.staleCount > 0 ? (
                          <span className="text-red-400 font-medium">{r.staleCount}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-zinc-700">
          <span className="text-zinc-500 text-xs">Nota média:</span>
          {SCORE_SCALE.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-zinc-400 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedFarmer && (
        <FarmerModal
          farmerName={modalTitle}
          deals={selectedDeals}
          onClose={() => setSelectedFarmer(null)}
        />
      )}
    </>
  )
}
