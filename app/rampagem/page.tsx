'use client'

import { useEffect, useState, useCallback } from 'react'
import type { RampagemData, RampagemFarmerData } from '@/lib/rampagem'
import type { RecordesData, MetricRecord, MonthlyRow } from '@/lib/recordes'

const REFRESH_MS = 5 * 60 * 1000

const MONTHS_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}

function fmtBRL(v: number): string {
  if (!v) return 'R$ 0'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function monthDisplayName(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS_PT[m] ?? m} ${y}`
}

function monthFull(m: string): string {
  const [, mm] = m.split('-')
  return MONTHS_PT[mm] ?? m
}

function fmtValue(key: string, v: number): string {
  if (key === 'valor') return fmtBRL(v)
  return v.toLocaleString('pt-BR')
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

type Tab = 'rampagem' | 'hall'

// ─── Shared helpers ───

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={`px-4 py-3 text-center ${bold ? 'font-bold text-base' : 'text-sm text-zinc-300'}`}>
      {children}
    </td>
  )
}

// ─── Rampagem components ───

function PodiumCard({ farmer, position, color }: {
  farmer: RampagemFarmerData; position: number; color: 'gold' | 'silver' | 'bronze'
}) {
  const barH = { gold: 'h-[120px]', silver: 'h-[88px]', bronze: 'h-[64px]' }[color]
  const borderColor = { gold: 'border-yellow-500', silver: 'border-zinc-400', bronze: 'border-orange-600' }[color]
  const textColor = { gold: 'text-yellow-400', silver: 'text-zinc-400', bronze: 'text-orange-500' }[color]
  const barBg = {
    gold: 'bg-yellow-500/10 border-yellow-500/25',
    silver: 'bg-zinc-400/5 border-zinc-500/15',
    bronze: 'bg-orange-600/5 border-orange-600/15',
  }[color]
  const glowClass = color === 'gold' ? 'animate-pulse-gold' : ''

  return (
    <div className="flex flex-col items-center w-[200px]">
      <div className="flex flex-col items-center gap-1.5 pb-3">
        <span className="text-3xl">{MEDALS[position]}</span>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold tracking-wide border-2 bg-zinc-900 ${borderColor} ${textColor}`}>
          {farmer.initials}
        </div>
        <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap">{farmer.name}</span>
        <span className={`text-4xl font-extrabold tabular-nums ${textColor}`}>{farmer.deals}</span>
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">negócios</span>
        {farmer.valor > 0 && (
          <span className={`text-xs font-semibold ${textColor} opacity-80`}>{fmtBRL(farmer.valor)}</span>
        )}
      </div>
      <div className={`w-full rounded-t-xl border border-b-0 flex items-center justify-center text-2xl font-extrabold opacity-25 ${barH} ${barBg} ${textColor} ${glowClass}`}>
        {position}
      </div>
    </div>
  )
}

function RankingTable({ farmers }: { farmers: RampagemFarmerData[] }) {
  return (
    <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-900/60">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr className="bg-zinc-800/60">
            <Th className="text-center w-12">#</Th>
            <Th className="text-left">Farmer</Th>
            <Th className="text-center">Neg</Th>
            <Th className="text-right min-w-[88px]">Valor</Th>
            <Th className="text-center">Reu.R</Th>
            <Th className="text-center">Reu.A</Th>
            <Th className="text-center">CE</Th>
            <Th className="text-center">TC</Th>
          </tr>
        </thead>
        <tbody>
          {farmers.map((f, i) => {
            const medalColor =
              f.rank === 1 ? 'text-yellow-400' :
              f.rank === 2 ? 'text-zinc-400' :
              f.rank === 3 ? 'text-orange-500' : 'text-zinc-500'
            const avatarBorder =
              f.rank === 1 ? 'border-yellow-500 text-yellow-400' :
              f.rank === 2 ? 'border-zinc-400 text-zinc-400' :
              f.rank === 3 ? 'border-orange-600 text-orange-500' :
              'border-zinc-700 text-zinc-500'
            return (
              <tr key={f.ownerId} className={`border-b border-zinc-800 last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                <td className={`px-4 py-3 text-center font-bold text-sm ${medalColor}`}>{f.rank}</td>
                <td className="px-4 py-3 font-semibold">
                  <div className="flex items-center gap-2.5">
                    {MEDALS[f.rank] && <span className="text-sm">{MEDALS[f.rank]}</span>}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold tracking-wide bg-zinc-900 border-[1.5px] shrink-0 ${avatarBorder}`}>
                      {f.initials}
                    </div>
                    <span className="text-zinc-100">{f.name}</span>
                  </div>
                </td>
                <Td bold>{f.deals}</Td>
                <td className={`px-4 py-3 text-right text-sm whitespace-nowrap ${f.valor > 0 ? 'font-semibold text-zinc-100' : 'text-zinc-600'}`}>
                  {fmtBRL(f.valor)}
                </td>
                <Td>{f.meetingsHeld}</Td>
                <Td>{f.meetingsScheduled}</Td>
                <Td>{f.effectiveContacts}</Td>
                <Td>{f.contactAttempts}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RampagemView({ data, onRefresh, error }: { data: RampagemData; onRefresh: () => void; error: string | null }) {
  const top3 = data.farmers.slice(0, 3)
  const podiumOrder: [RampagemFarmerData, 'silver' | 'gold' | 'bronze', number][] = [
    [top3[1], 'silver', 2],
    [top3[0], 'gold', 1],
    [top3[2], 'bronze', 3],
  ]
  const ts = new Date(data.updatedAt)
  const updatedStr = `${String(ts.getDate()).padStart(2, '0')}/${String(ts.getMonth() + 1).padStart(2, '0')}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <>
      <main className="flex-1 flex flex-col gap-6 px-8 py-6 overflow-hidden">
        <section className="flex items-end justify-center gap-1.5">
          {podiumOrder.map(([farmer, color, pos]) => (
            <PodiumCard key={farmer.ownerId} farmer={farmer} position={pos} color={color} />
          ))}
        </section>
        <section className="flex-1 flex flex-col gap-2 min-h-0">
          <RankingTable farmers={data.farmers} />
          <MetricLegend />
        </section>
      </main>
      <Footer updatedStr={updatedStr} onRefresh={onRefresh} error={error} />
    </>
  )
}

// ─── Hall da Fama components ───

const METRIC_ICONS: Record<string, string> = {
  deals: '\u{1F4BC}', valor: '\u{1F4B0}', meetingsHeld: '\u{1F91D}',
  meetingsScheduled: '\u{1F4C5}', effectiveContacts: '\u{1F4DE}', contactAttempts: '\u{1F4E2}',
}

const METRIC_SHORT: Record<string, string> = {
  deals: 'Neg', valor: 'Valor', meetingsHeld: 'Reu.R',
  meetingsScheduled: 'Reu.A', effectiveContacts: 'CE', contactAttempts: 'TC',
}

function RecordCard({ record }: { record: MetricRecord }) {
  const [first, second, third] = record.podium
  if (!first) {
    return (
      <div className="border border-zinc-800 rounded-xl bg-zinc-900/60 p-5 flex flex-col items-center justify-center min-h-[200px]">
        <span className="text-2xl mb-2">{METRIC_ICONS[record.key] ?? '\u{1F3C6}'}</span>
        <span className="text-xs uppercase tracking-widest text-zinc-500 text-center">{record.label}</span>
        <span className="text-zinc-600 text-sm mt-3">Sem dados</span>
      </div>
    )
  }

  return (
    <div className="relative border border-zinc-800 rounded-xl bg-zinc-900/60 overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-yellow-500/0 via-yellow-500/60 to-yellow-500/0" />
      <div className="p-5 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{METRIC_ICONS[record.key] ?? '\u{1F3C6}'}</span>
          <span className="text-[11px] uppercase tracking-[.15em] font-semibold text-zinc-400">{record.label}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold tracking-wide border-2 bg-zinc-900 border-yellow-500 text-yellow-400">
            {first.initials}
          </div>
          <span className="text-sm font-semibold text-zinc-100">{first.name}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-extrabold text-yellow-400 tabular-nums">{fmtValue(record.key, first.value)}</span>
          <span className="text-[10px] text-zinc-500 mt-0.5">{monthFull(first.month)}</span>
        </div>
        {(second || third) && (
          <div className="flex gap-4 mt-1 pt-3 border-t border-zinc-800 w-full justify-center">
            {second && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-sm">{'\u{1F948}'}</span>
                <span className="font-medium">{second.name}</span>
                <span className="text-zinc-500 tabular-nums">{fmtValue(record.key, second.value)}</span>
              </div>
            )}
            {third && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-sm">{'\u{1F949}'}</span>
                <span className="font-medium">{third.name}</span>
                <span className="text-zinc-500 tabular-nums">{fmtValue(record.key, third.value)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MonthlyTable({ monthly, metricKeys }: { monthly: MonthlyRow[]; metricKeys: string[] }) {
  return (
    <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-900/60">
      <table className="w-full border-collapse tabular-nums text-sm">
        <thead>
          <tr className="bg-zinc-800/60">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Mês</th>
            {metricKeys.map((k) => (
              <th key={k} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                {METRIC_SHORT[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthly.map((row, i) => (
            <tr key={row.month} className={`border-b border-zinc-800 last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
              <td className="px-4 py-2.5 font-medium text-zinc-300 whitespace-nowrap">{row.label}</td>
              {metricKeys.map((k) => {
                const best = row.bests[k]
                if (!best || best.value <= 0) {
                  return <td key={k} className="px-3 py-2.5 text-center text-zinc-700">—</td>
                }
                return (
                  <td key={k} className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-zinc-200 tabular-nums">{fmtValue(k, best.value)}</span>
                      <span className="text-[10px] text-zinc-500">{best.initials}</span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HallView({ data, loading, error, onRefresh }: {
  data: RecordesData | null; loading: boolean; error: string | null; onRefresh: () => void
}) {
  if (loading && !data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="text-zinc-500 text-lg animate-pulse">Carregando recordes...</div>
        <div className="text-zinc-600 text-xs">Primeira carga pode levar até 60 segundos</div>
      </main>
    )
  }

  if (error && !data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button onClick={onRefresh} className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">
          Tentar novamente
        </button>
      </main>
    )
  }

  if (!data) return null

  const metricKeys = data.records.map((r) => r.key)
  const ts = new Date(data.updatedAt)
  const updatedStr = `${String(ts.getDate()).padStart(2, '0')}/${String(ts.getMonth() + 1).padStart(2, '0')}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <>
      <main className="flex-1 flex flex-col gap-8 px-8 py-6 overflow-auto">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.records.map((rec) => (
            <RecordCard key={rec.key} record={rec} />
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Melhores do mês</h2>
          <MonthlyTable monthly={data.monthly} metricKeys={metricKeys} />
          <MetricLegend />
        </section>
      </main>
      <Footer updatedStr={updatedStr} onRefresh={onRefresh} loading={loading} error={error} />
    </>
  )
}

// ─── Shared layout components ───

function MetricLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-zinc-500">
      <span>Neg = Negócios criados</span>
      <span>Valor = Valor fechado (R$)</span>
      <span>Reu.R = Reuniões realizadas</span>
      <span>Reu.A = Reuniões agendadas</span>
      <span>CE = Contatos efetivos</span>
      <span>TC = Tentativas de contato</span>
    </div>
  )
}

function Footer({ updatedStr, onRefresh, loading, error }: {
  updatedStr: string; onRefresh: () => void; loading?: boolean; error?: string | null
}) {
  return (
    <footer className="flex items-center justify-between px-8 py-3 border-t border-zinc-800 text-xs text-zinc-500">
      <span>
        Dados: HubSpot &middot; Atualizado em {updatedStr}
        {loading && <span className="text-yellow-500 ml-3">(atualizando...)</span>}
        {error && <span className="text-yellow-500 ml-3">(falha no último refresh)</span>}
      </span>
      <button onClick={onRefresh} disabled={loading} className="text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50">
        Atualizar agora
      </button>
    </footer>
  )
}

// ─── Main page ───

export default function RampagemPage() {
  const [tab, setTab] = useState<Tab>('rampagem')

  // Rampagem state
  const [rampData, setRampData] = useState<RampagemData | null>(null)
  const [rampError, setRampError] = useState<string | null>(null)
  const [rampLoading, setRampLoading] = useState(true)

  // Hall da Fama state
  const [hallData, setHallData] = useState<RecordesData | null>(null)
  const [hallError, setHallError] = useState<string | null>(null)
  const [hallLoading, setHallLoading] = useState(false)
  const [hallLoaded, setHallLoaded] = useState(false)

  const loadRampagem = useCallback(async () => {
    try {
      const resp = await fetch('/api/rampagem')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setRampData(await resp.json())
      setRampError(null)
    } catch (err) {
      setRampError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setRampLoading(false)
    }
  }, [])

  const loadHall = useCallback(async (force = false) => {
    setHallLoading(true)
    try {
      const resp = await fetch(`/api/recordes${force ? '?force=1' : ''}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setHallData(await resp.json())
      setHallError(null)
    } catch (err) {
      setHallError(err instanceof Error ? err.message : 'Erro ao carregar recordes')
    } finally {
      setHallLoading(false)
      setHallLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadRampagem()
    const interval = setInterval(loadRampagem, REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadRampagem])

  // Load hall data on first tab switch
  useEffect(() => {
    if (tab === 'hall' && !hallLoaded) loadHall()
  }, [tab, hallLoaded, loadHall])

  if (rampLoading && !rampData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-500 text-lg animate-pulse">Carregando dados do HubSpot...</div>
      </div>
    )
  }

  if (rampError && !rampData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-red-400 text-lg">{rampError}</div>
        <button onClick={loadRampagem} className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!rampData) return null

  return (
    <div className="flex flex-col min-h-screen">
      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
          50% { box-shadow: 0 0 30px 0 rgba(234, 179, 8, 0.08); }
        }
        .animate-pulse-gold { animation: pulse-gold 4s ease-in-out infinite; }
      `}</style>

      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-extrabold tracking-[.12em] uppercase">
            {tab === 'rampagem' ? 'Rampagem' : 'Hall da Fama'}
          </h1>
          <span className="text-base text-zinc-400 font-medium">
            {tab === 'rampagem' ? monthDisplayName(rampData.month) : hallData ? String(hallData.year) : ''}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-800/60 rounded-lg border border-zinc-700 p-0.5">
            <button
              onClick={() => setTab('rampagem')}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${
                tab === 'rampagem' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Rampagem
            </button>
            <button
              onClick={() => setTab('hall')}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${
                tab === 'hall' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Hall da Fama
            </button>
          </div>

          {tab === 'rampagem' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">
                {rampData.daysLeft} dias restantes
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </div>
      </header>

      {tab === 'rampagem' ? (
        <RampagemView data={rampData} onRefresh={loadRampagem} error={rampError} />
      ) : (
        <HallView data={hallData} loading={hallLoading} error={hallError} onRefresh={() => loadHall(true)} />
      )}
    </div>
  )
}
