'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Deal } from '@/lib/hubspot'
import { CRITERIA, isB2CCloser } from '@/lib/constants'

interface DealsTableProps {
  deals: Deal[]
}

const PAGE_SIZE = 20

function ScoreBadge({ score, isScored }: { score: number; isScored: boolean }) {
  if (!isScored) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border bg-zinc-700/60 text-zinc-400 border-zinc-600">
        Fora do SAL
      </span>
    )
  }
  let colorClass = 'bg-red-900/50 text-red-300 border-red-700'
  if (score >= 9) colorClass = 'bg-green-900/50 text-green-300 border-green-700'
  else if (score >= 7) colorClass = 'bg-yellow-900/50 text-yellow-300 border-yellow-700'

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${colorClass}`}>
      {score} / 12
    </span>
  )
}

function MissingCriterionPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300 border border-red-800 whitespace-nowrap">
      {label}
    </span>
  )
}

function MeetingBadge({ scheduled, completed }: { scheduled: boolean; completed: boolean }) {
  if (!scheduled) return null
  if (completed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-900/40 text-green-300 border border-green-800 whitespace-nowrap">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Realizada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-800 whitespace-nowrap">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Agendada
    </span>
  )
}

function getDealCategory(deal: Deal): 'B2C' | 'CRM' | 'B2B' {
  if (deal.ownerName && isB2CCloser(deal.ownerName)) return 'B2C'
  if (deal.origemDoLead === 'Ação de CRM') return 'CRM'
  return 'B2B'
}

function CategoryBadge({ category }: { category: 'B2C' | 'CRM' | 'B2B' }) {
  const styles = {
    B2C: 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
    CRM: 'bg-orange-900/40 text-orange-300 border-orange-700',
    B2B: 'bg-zinc-700/40 text-zinc-400 border-zinc-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[category]}`}>
      {category === 'CRM' ? 'Ação CRM' : category}
    </span>
  )
}

type SortKey = 'date' | 'score' | 'name' | 'farmerName' | 'ownerName'
type SortDir = 'asc' | 'desc'

export default function DealsTable({ deals }: DealsTableProps) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  const sorted = useMemo(() => {
    const arr = [...deals]
    arr.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortKey) {
        case 'date':
          aVal = a.date ? new Date(a.date).getTime() : 0
          bVal = b.date ? new Date(b.date).getTime() : 0
          break
        case 'score':
          aVal = a.score
          bVal = b.score
          break
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'farmerName':
          aVal = a.farmerName.toLowerCase()
          bVal = b.farmerName.toLowerCase()
          break
        case 'ownerName':
          aVal = a.ownerName.toLowerCase()
          bVal = b.ownerName.toLowerCase()
          break
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [deals, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) {
      return (
        <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortDir === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
    )
  }

  return (
    <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden">
      <div className="p-6 border-b border-zinc-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Negócios</h2>
          <span className="text-zinc-400 text-sm">{deals.length} negócios</span>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-zinc-400">
          Nenhum negócio encontrado para o período selecionado
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/50 text-zinc-400 border-b border-zinc-700">
                  <th className="text-left py-3 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                      onClick={() => handleSort('name')}
                    >
                      Negócio <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                      onClick={() => handleSort('farmerName')}
                    >
                      Farmer <SortIcon field="farmerName" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                      onClick={() => handleSort('ownerName')}
                    >
                      Curador <SortIcon field="ownerName" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Tipo</th>
                  <th className="text-left py-3 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                      onClick={() => handleSort('date')}
                    >
                      Data <SortIcon field="date" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button
                      className="flex items-center gap-1 hover:text-zinc-200 transition"
                      onClick={() => handleSort('score')}
                    >
                      Pontuação <SortIcon field="score" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Reunião</th>
                  <th className="text-left py-3 px-4 font-medium">Critérios faltantes</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((deal) => (
                  <tr
                    key={deal.id}
                    className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition"
                  >
                    <td className="py-3 px-4 max-w-xs">
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
                    <td className="py-3 px-4 text-zinc-300">{deal.farmerName}</td>
                    <td className="py-3 px-4 text-zinc-400 text-sm whitespace-nowrap">{deal.ownerName || '—'}</td>
                    <td className="py-3 px-4">
                      <CategoryBadge category={getDealCategory(deal)} />
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {deal.date
                        ? format(new Date(deal.date), "dd/MM/yyyy", { locale: ptBR })
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <ScoreBadge score={deal.score} isScored={deal.isScored} />
                    </td>
                    <td className="py-3 px-4">
                      <MeetingBadge scheduled={deal.meetingScheduled} completed={deal.meetingCompleted} />
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const missing = CRITERIA.filter((c) => !deal.criteria.includes(c.key))
                        return missing.length === 0 ? (
                          <span className="text-green-500 text-xs font-medium">Completo</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {missing.map((c) => (
                              <MissingCriterionPill key={c.key} label={c.label} />
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-zinc-700 flex items-center justify-between">
              <p className="text-zinc-400 text-sm">
                Página {page} de {totalPages} — {deals.length} negócios
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
