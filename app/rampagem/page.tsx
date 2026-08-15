'use client'

import { useEffect, useState, useCallback } from 'react'
import type { RampagemData, RampagemFarmerData } from '@/lib/rampagem'

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

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function PodiumCard({
  farmer,
  position,
  color,
}: {
  farmer: RampagemFarmerData
  position: number
  color: 'gold' | 'silver' | 'bronze'
}) {
  const barH = { gold: 'h-[120px]', silver: 'h-[88px]', bronze: 'h-[64px]' }[color]

  const borderColor = {
    gold: 'border-yellow-500',
    silver: 'border-zinc-400',
    bronze: 'border-orange-600',
  }[color]

  const textColor = {
    gold: 'text-yellow-400',
    silver: 'text-zinc-400',
    bronze: 'text-orange-500',
  }[color]

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
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold tracking-wide border-2 bg-zinc-900 ${borderColor} ${textColor}`}
        >
          {farmer.initials}
        </div>
        <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap">
          {farmer.name}
        </span>
        <span className={`text-4xl font-extrabold tabular-nums ${textColor}`}>
          {farmer.deals}
        </span>
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
          negócios
        </span>
        {farmer.valor > 0 && (
          <span className={`text-xs font-semibold ${textColor} opacity-80`}>
            {fmtBRL(farmer.valor)}
          </span>
        )}
      </div>
      <div
        className={`w-full rounded-t-xl border border-b-0 flex items-center justify-center text-2xl font-extrabold opacity-25 ${barH} ${barBg} ${textColor} ${glowClass}`}
      >
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
              <tr
                key={f.ownerId}
                className={`border-b border-zinc-800 last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
              >
                <td className={`px-4 py-3 text-center font-bold text-sm ${medalColor}`}>
                  {f.rank}
                </td>
                <td className="px-4 py-3 font-semibold">
                  <div className="flex items-center gap-2.5">
                    {MEDALS[f.rank] && (
                      <span className="text-sm">{MEDALS[f.rank]}</span>
                    )}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold tracking-wide bg-zinc-900 border-[1.5px] shrink-0 ${avatarBorder}`}
                    >
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

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap ${className}`}
    >
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

export default function RampagemPage() {
  const [data, setData] = useState<RampagemData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/rampagem')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as RampagemData
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-500 text-lg animate-pulse">Carregando dados do HubSpot...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const top3 = data.farmers.slice(0, 3)
  const podiumOrder: [RampagemFarmerData, 'silver' | 'gold' | 'bronze', number][] = [
    [top3[1], 'silver', 2],
    [top3[0], 'gold', 1],
    [top3[2], 'bronze', 3],
  ]

  const ts = new Date(data.updatedAt)
  const updatedStr = `${String(ts.getDate()).padStart(2, '0')}/${String(ts.getMonth() + 1).padStart(2, '0')}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col min-h-screen">
      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
          50% { box-shadow: 0 0 30px 0 rgba(234, 179, 8, 0.08); }
        }
        .animate-pulse-gold { animation: pulse-gold 4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-extrabold tracking-[.12em] uppercase">
            Rampagem
          </h1>
          <span className="text-base text-zinc-400 font-medium">
            {monthDisplayName(data.month)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">
            {data.daysLeft} dias restantes
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col gap-6 px-8 py-6 overflow-hidden">
        {/* Podium */}
        <section className="flex items-end justify-center gap-1.5">
          {podiumOrder.map(([farmer, color, pos]) => (
            <PodiumCard key={farmer.ownerId} farmer={farmer} position={pos} color={color} />
          ))}
        </section>

        {/* Table */}
        <section className="flex-1 flex flex-col gap-2 min-h-0">
          <RankingTable farmers={data.farmers} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-zinc-500">
            <span>Neg = Negócios criados</span>
            <span>Valor = Valor fechado (R$)</span>
            <span>Reu.R = Reuniões realizadas</span>
            <span>Reu.A = Reuniões agendadas</span>
            <span>CE = Contatos efetivos</span>
            <span>TC = Tentativas de contato</span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-8 py-3 border-t border-zinc-800 text-xs text-zinc-500">
        <span>
          Dados: HubSpot &middot; Atualizado em {updatedStr}
          {error && <span className="text-yellow-500 ml-3">(falha no último refresh)</span>}
        </span>
        <button
          onClick={load}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Atualizar agora
        </button>
      </footer>
    </div>
  )
}
