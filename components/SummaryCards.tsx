'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { SummaryStats } from '@/lib/analytics'
import { Deal } from '@/lib/hubspot'
import { uniqueDemandKey } from '@/lib/constants'

interface SummaryCardsProps {
  stats: SummaryStats
  deals: Deal[]
}

const ICONS = {
  deals: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  companies: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  score: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  farmers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  meeting: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
}

function Card({
  title, value, subtitle, icon, highlight, onClick,
}: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode
  highlight?: boolean; onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  const borderClass = highlight ? 'border-[#FF5200]/40' : 'border-zinc-700'
  const accentColor = highlight ? '#FF5200' : '#334155'
  return (
    <Wrapper
      onClick={onClick}
      className={`relative bg-zinc-800 rounded-xl p-5 border overflow-hidden text-left w-full ${borderClass} ${onClick ? 'cursor-pointer hover:bg-zinc-750 hover:border-zinc-600 transition group' : ''}`}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: accentColor }}
      />
      <div className="flex items-start justify-between mb-3">
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <span className={`${highlight ? 'text-[#FF5200]' : 'text-zinc-500'}`}>{icon}</span>
      </div>
      <p className="text-white font-bold mb-1" style={{ fontSize: '2rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-zinc-500 text-xs mt-1">
          {subtitle}
          {onClick && <span className="text-zinc-600 group-hover:text-orange-400 ml-1 transition">· ver lista</span>}
        </p>
      )}
    </Wrapper>
  )
}

type ModalType = 'deals' | 'companies'

interface ListEntry {
  key: string
  label: string
  hubspotUrl: string
  date: string
  farmerName: string
  count?: number
}

function buildDealList(deals: Deal[]): ListEntry[] {
  return [...deals]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      key: d.id,
      label: d.name,
      hubspotUrl: d.hubspotUrl,
      date: d.date,
      farmerName: d.farmerName,
    }))
}

function buildCompanyList(deals: Deal[]): ListEntry[] {
  const byCompany = new Map<string, { rep: Deal; count: number }>()
  for (const d of deals) {
    const ck = uniqueDemandKey(d)
    const existing = byCompany.get(ck)
    if (existing) {
      existing.count++
    } else {
      byCompany.set(ck, { rep: d, count: 1 })
    }
  }
  return Array.from(byCompany.entries())
    .map(([key, { rep, count }]) => ({
      key,
      label: rep.name,
      hubspotUrl: rep.hubspotUrl,
      date: rep.date,
      farmerName: rep.farmerName,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function ListModal({
  title, accent, entries, onClose,
}: {
  title: string; accent: string; entries: ListEntry[]; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[75vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              <h3 className="text-white font-semibold">{title}</h3>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">{entries.length} itens</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-zinc-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-zinc-400 text-sm">Nenhum item</div>
          ) : (
            <ul className="divide-y divide-zinc-700/50">
              {entries.map((e) => (
                <li key={e.key} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-700/30 transition">
                  <div className="min-w-0 flex-1">
                    <a
                      href={e.hubspotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-200 font-medium hover:text-orange-400 transition text-sm truncate block"
                      title={e.label}
                    >
                      {e.label}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{e.farmerName}</span>
                      {e.date && <span>· {format(new Date(e.date), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                      {e.count && e.count > 1 && <span>· {e.count} demandas</span>}
                    </div>
                  </div>
                  <a
                    href={e.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 flex-shrink-0 text-zinc-500 hover:text-orange-400 transition"
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

export default function SummaryCards({ stats, deals }: SummaryCardsProps) {
  const [modal, setModal] = useState<ModalType | null>(null)

  const meetingRate = stats.meetingScheduled > 0
    ? Math.round((stats.meetingCompleted / stats.meetingScheduled) * 100)
    : null

  const modalEntries = modal === 'deals'
    ? buildDealList(deals)
    : modal === 'companies'
      ? buildCompanyList(deals)
      : []
  const modalTitle = modal === 'deals' ? 'Todos os Negócios' : 'Empresas Únicas'
  const modalAccent = modal === 'deals' ? '#64748b' : '#FF5200'

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          title="Total de Negócios"
          value={stats.totalDeals.toLocaleString('pt-BR')}
          subtitle="todos os negócios"
          icon={ICONS.deals}
          onClick={() => setModal('deals')}
        />
        <Card
          title="Total de Empresas"
          value={stats.totalCompanies.toLocaleString('pt-BR')}
          subtitle="empresas únicas"
          icon={ICONS.companies}
          highlight
          onClick={() => setModal('companies')}
        />
        <Card
          title="Média de Pontuação"
          value={`${stats.avgScore.toFixed(1)} / 12`}
          subtitle="pontuação média geral"
          icon={ICONS.score}
        />
        <Card
          title="Farmers Ativos"
          value={stats.activeFarmers.toString()}
          subtitle="com ao menos 1 negócio"
          icon={ICONS.farmers}
        />
        <Card
          title="Reuniões"
          value={meetingRate !== null ? `${meetingRate}%` : '—'}
          subtitle={`${stats.meetingCompleted} realizadas / ${stats.meetingScheduled} agendadas`}
          icon={ICONS.meeting}
        />
      </div>

      {modal && (
        <ListModal
          title={modalTitle}
          accent={modalAccent}
          entries={modalEntries}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
