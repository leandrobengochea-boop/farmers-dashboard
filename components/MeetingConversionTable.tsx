'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FarmerMeetingStats } from '@/lib/analytics'
import { Deal } from '@/lib/hubspot'
import { uniqueDemandKey } from '@/lib/constants'

interface Props {
  data: FarmerMeetingStats[]
  deals: Deal[]
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
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

type ModalType = 'scheduled' | 'completed'

interface CompanyEntry {
  key: string
  label: string
  hubspotUrl: string
  dealCount: number
  date: string
}

// Agrupa os negócios de um farmer por empresa e retorna as empresas que
// têm reunião agendada ou realizada (conforme o tipo).
function companiesFor(deals: Deal[], farmerId: string, type: ModalType): CompanyEntry[] {
  const byCompany = new Map<string, Deal[]>()
  for (const d of deals) {
    if (d.farmerId !== farmerId) continue
    const ck = uniqueDemandKey(d)
    const arr = byCompany.get(ck) ?? []
    arr.push(d)
    byCompany.set(ck, arr)
  }

  const result: CompanyEntry[] = []
  for (const [key, ds] of byCompany.entries()) {
    const matches = ds.some((d) => (type === 'completed' ? d.meetingCompleted : d.meetingScheduled))
    if (!matches) continue
    // negócio representativo: o que satisfaz a condição (preferência), senão o primeiro
    const rep =
      ds.find((d) => (type === 'completed' ? d.meetingCompleted : d.meetingScheduled)) ?? ds[0]
    result.push({
      key,
      label: rep.name,
      hubspotUrl: rep.hubspotUrl,
      dealCount: ds.length,
      date: rep.date,
    })
  }
  return result.sort((a, b) => a.label.localeCompare(b.label))
}

interface CompanyModalProps {
  farmerName: string
  type: ModalType
  companies: CompanyEntry[]
  onClose: () => void
}

function CompanyModal({ farmerName, type, companies, onClose }: CompanyModalProps) {
  const isDone = type === 'completed'
  const accent = isDone ? '#22c55e' : '#f97316'
  const title = isDone ? 'Reuniões realizadas' : 'Reuniões agendadas'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[75vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              <h3 className="text-white font-semibold">{title} — {farmerName}</h3>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">
              {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
            </p>
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
          {companies.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-zinc-400 text-sm">
              Nenhuma empresa encontrada
            </div>
          ) : (
            <ul className="divide-y divide-zinc-700/50">
              {companies.map((c) => (
                <li key={c.key} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-700/30 transition">
                  <div className="min-w-0">
                    <a
                      href={c.hubspotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-200 font-medium hover:text-orange-400 transition text-sm truncate block"
                      title={c.label}
                    >
                      {c.label}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {c.date && <span>{format(new Date(c.date), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                      {c.dealCount > 1 && <span>· {c.dealCount} demandas</span>}
                    </div>
                  </div>
                  <a
                    href={c.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 flex-shrink-0 text-zinc-500 hover:text-orange-400 transition"
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

export default function MeetingConversionTable({ data, deals }: Props) {
  const [open, setOpen] = useState<{ farmerId: string; farmerName: string; type: ModalType } | null>(null)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
        Nenhum agendamento registrado
      </div>
    )
  }

  const modalCompanies = open ? companiesFor(deals, open.farmerId, open.type) : []

  return (
    <>
      <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-zinc-800 z-10">
            <tr className="text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-medium">Farmer</th>
              <th className="text-right py-2 px-3 font-medium whitespace-nowrap" title="Empresas únicas">Empresas</th>
              <th className="py-2 px-3 font-medium min-w-[110px]">Agendadas</th>
              <th className="py-2 px-3 font-medium min-w-[110px]">Realizadas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f) => (
              <tr
                key={f.farmerId}
                className="border-t border-zinc-700/50 hover:bg-zinc-700/20 transition"
              >
                <td className="py-2 px-3 text-zinc-300 font-medium whitespace-nowrap">{f.farmerName}</td>
                <td className="py-2 px-3 text-zinc-500 text-right tabular-nums" title={`${f.totalDeals} oportunidades`}>{f.totalCompanies}</td>
                <td className="py-2 px-3">
                  <button
                    type="button"
                    onClick={() => setOpen({ farmerId: f.farmerId, farmerName: f.farmerName, type: 'scheduled' })}
                    className="flex flex-col gap-0.5 w-full text-left rounded hover:bg-zinc-700/40 px-1 -mx-1 py-0.5 transition cursor-pointer"
                    title="Ver empresas com reunião agendada"
                  >
                    <span className="text-[11px] text-zinc-500">{f.scheduled} de {f.totalCompanies}</span>
                    <MiniBar pct={f.scheduledPct} color="#f97316" />
                  </button>
                </td>
                <td className="py-2 px-3">
                  <button
                    type="button"
                    onClick={() => setOpen({ farmerId: f.farmerId, farmerName: f.farmerName, type: 'completed' })}
                    className="flex flex-col gap-0.5 w-full text-left rounded hover:bg-zinc-700/40 px-1 -mx-1 py-0.5 transition cursor-pointer"
                    title="Ver empresas com reunião realizada"
                  >
                    <span className="text-[11px] text-zinc-500">{f.completed} de {f.scheduled}</span>
                    <MiniBar pct={f.completedPct} color="#22c55e" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <CompanyModal
          farmerName={open.farmerName}
          type={open.type}
          companies={modalCompanies}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
