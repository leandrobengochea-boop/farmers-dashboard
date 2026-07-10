'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExcludedDeal, ForaDoMOAEntry } from '@/lib/hubspot'
import { dealInTeam } from '@/lib/constants'

interface Props {
  foraDoMOA: ForaDoMOAEntry[]
  excludedDeals: ExcludedDeal[]
  selectedTeam: string | null
  selectedMonth: string | null
}

function getFilteredDeals(
  excludedDeals: ExcludedDeal[],
  farmerName: string,
  selectedTeam: string | null,
  selectedMonth: string | null,
): ExcludedDeal[] {
  let deals = excludedDeals.filter((d) => d.farmerName === farmerName)

  if (selectedTeam) {
    deals = deals.filter((d) => dealInTeam(d.farmerId, d.date, selectedTeam))
  }

  if (selectedMonth) {
    deals = deals.filter((d) => {
      if (!d.date) return false
      const date = new Date(d.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return key === selectedMonth
    })
  }

  return deals.sort((a, b) => (b.date > a.date ? 1 : -1))
}

interface DealListModalProps {
  farmerName: string
  deals: ExcludedDeal[]
  onClose: () => void
}

function DealListModal({ farmerName, deals, onClose }: DealListModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 className="text-white font-semibold">Fora do MOA — {farmerName}</h3>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">{deals.length} {deals.length === 1 ? 'negócio excluído' : 'negócios excluídos'}</p>
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
          {deals.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-zinc-400 text-sm">
              Nenhum negócio encontrado
            </div>
          ) : (
            <ul className="divide-y divide-zinc-700/50">
              {deals.map((deal) => (
                <li key={deal.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-700/30 transition">
                  <div className="min-w-0">
                    <a
                      href={deal.hubspotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-200 font-medium hover:text-amber-400 transition text-sm truncate block"
                      title={deal.name}
                    >
                      {deal.name}
                    </a>
                    {deal.date && (
                      <span className="text-zinc-500 text-xs">
                        {format(new Date(deal.date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <a
                    href={deal.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 flex-shrink-0 text-zinc-500 hover:text-amber-400 transition"
                    title="Abrir no HubSpot"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ForaDoMOABar({ foraDoMOA, excludedDeals, selectedTeam, selectedMonth }: Props) {
  const [openFarmer, setOpenFarmer] = useState<string | null>(null)

  const modalDeals = openFarmer
    ? getFilteredDeals(excludedDeals, openFarmer, selectedTeam, selectedMonth)
    : []

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-5 py-3">
        <div className="flex items-center gap-1.5 mr-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Fora do MOA</span>
        </div>
        {foraDoMOA.map(({ farmerName, count }) => (
          <button
            key={farmerName}
            onClick={() => setOpenFarmer(farmerName)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:brightness-110 cursor-pointer"
            style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)', color: '#fbbf24' }}
            title={`Ver ${count} negócio${count > 1 ? 's' : ''} de ${farmerName}`}
          >
            {farmerName}
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'rgba(217,119,6,0.25)', color: '#f59e0b', width: 18, height: 18 }}
            >
              {count}
            </span>
          </button>
        ))}
        <span className="text-amber-800/60 text-xs ml-1">clique para ver os negócios</span>
      </div>

      {openFarmer && (
        <DealListModal
          farmerName={openFarmer}
          deals={modalDeals}
          onClose={() => setOpenFarmer(null)}
        />
      )}
    </>
  )
}
