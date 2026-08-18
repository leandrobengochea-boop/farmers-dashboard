'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SalaoData, SalaoFarmerData } from '@/lib/salao'

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

function PodiumCard({ farmer, position, tier }: {
  farmer: SalaoFarmerData; position: number; tier: 'first' | 'second' | 'third'
}) {
  const barH = { first: 'h-[140px]', second: 'h-[100px]', third: 'h-[72px]' }[tier]

  const border = {
    first: 'border-orange-400',
    second: 'border-orange-300/60',
    third: 'border-orange-600/60',
  }[tier]

  const text = {
    first: 'text-orange-400',
    second: 'text-orange-300',
    third: 'text-orange-600',
  }[tier]

  const barBg = {
    first: 'bg-gradient-to-t from-orange-500/20 to-orange-400/5 border-orange-500/30',
    second: 'bg-gradient-to-t from-orange-400/10 to-orange-300/5 border-orange-400/15',
    third: 'bg-gradient-to-t from-orange-700/10 to-orange-600/5 border-orange-700/15',
  }[tier]

  const glow = tier === 'first' ? 'shadow-[0_0_40px_rgba(251,146,60,0.12)]' : ''

  return (
    <div className={`flex flex-col items-center w-[220px] ${glow}`}>
      <div className="flex flex-col items-center gap-2 pb-4">
        <span className="text-4xl">{MEDALS[position]}</span>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold tracking-wide border-2 bg-zinc-950 ${border} ${text}`}>
          {farmer.initials}
        </div>
        <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap">{farmer.name}</span>
        <span className={`text-5xl font-black tabular-nums ${text}`}>{farmer.deals}</span>
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[.2em]">negócios</span>
        {farmer.valor > 0 && (
          <span className={`text-xs font-semibold ${text} opacity-75`}>{fmtBRL(farmer.valor)}</span>
        )}
      </div>
      <div className={`w-full rounded-t-2xl border border-b-0 flex items-center justify-center text-3xl font-black opacity-20 ${barH} ${barBg} ${text}`}>
        {position}
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

function RankingTable({ farmers }: { farmers: SalaoFarmerData[] }) {
  return (
    <div className="overflow-x-auto border border-zinc-800/80 rounded-2xl bg-zinc-900/40 backdrop-blur">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr className="bg-zinc-800/40">
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
            const rankColor =
              f.rank === 1 ? 'text-orange-400' :
              f.rank === 2 ? 'text-orange-300' :
              f.rank === 3 ? 'text-orange-600' : 'text-zinc-600'

            const avatarStyle =
              f.rank === 1 ? 'border-orange-400 text-orange-400' :
              f.rank === 2 ? 'border-orange-300/60 text-orange-300' :
              f.rank === 3 ? 'border-orange-600/60 text-orange-600' :
              'border-zinc-800 text-zinc-600'

            const rowBg = f.rank <= 3
              ? 'bg-orange-500/[0.03]'
              : i % 2 === 1 ? 'bg-white/[0.01]' : ''

            return (
              <tr key={f.ownerId} className={`border-b border-zinc-800/60 last:border-b-0 ${rowBg}`}>
                <td className={`px-4 py-3 text-center font-bold text-sm ${rankColor}`}>{f.rank}</td>
                <td className="px-4 py-3 font-semibold">
                  <div className="flex items-center gap-2.5">
                    {MEDALS[f.rank] && <span className="text-sm">{MEDALS[f.rank]}</span>}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold tracking-wide bg-zinc-950 border-[1.5px] shrink-0 ${avatarStyle}`}>
                      {f.initials}
                    </div>
                    <span className={f.rank <= 3 ? 'text-zinc-100' : 'text-zinc-400'}>{f.name}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-center ${f.rank <= 3 ? 'font-bold text-base text-zinc-100' : 'font-semibold text-sm text-zinc-400'}`}>
                  {f.deals}
                </td>
                <td className={`px-4 py-3 text-right text-sm whitespace-nowrap ${f.valor > 0 ? 'font-semibold text-zinc-200' : 'text-zinc-700'}`}>
                  {fmtBRL(f.valor)}
                </td>
                <td className="px-4 py-3 text-center text-sm text-zinc-400">{f.meetingsHeld}</td>
                <td className="px-4 py-3 text-center text-sm text-zinc-400">{f.meetingsScheduled}</td>
                <td className="px-4 py-3 text-center text-sm text-zinc-400">{f.effectiveContacts}</td>
                <td className="px-4 py-3 text-center text-sm text-zinc-400">{f.contactAttempts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SalaoPage() {
  const [data, setData] = useState<SalaoData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/salao')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setData(await resp.json())
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
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-orange-400/60 text-lg animate-pulse">Carregando dados...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button onClick={load} className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const top3 = data.farmers.slice(0, 3)
  const podiumOrder: [SalaoFarmerData, 'second' | 'first' | 'third', number][] = [
    [top3[1], 'second', 2],
    [top3[0], 'first', 1],
    [top3[2], 'third', 3],
  ]

  const ts = new Date(data.updatedAt)
  const updatedStr = `${String(ts.getDate()).padStart(2, '0')}/${String(ts.getMonth() + 1).padStart(2, '0')}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 relative overflow-hidden">
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/[0.04] rounded-full blur-[120px] pointer-events-none" style={{ animation: 'glow-pulse 6s ease-in-out infinite' }} />

      {/* Header */}
      <header className="relative flex items-center justify-between px-8 py-5 border-b border-zinc-800/60">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-black tracking-[.14em] uppercase bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
            Ranking Farmers
          </h1>
          <span className="text-base text-zinc-500 font-medium">{monthDisplayName(data.month)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-orange-400/70 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
            {data.daysLeft} dias restantes
          </span>
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 flex flex-col gap-6 px-8 py-6 overflow-auto">
        {/* Podium */}
        <section className="flex items-end justify-center gap-2 py-2">
          {podiumOrder.map(([farmer, tier, pos]) => (
            <PodiumCard key={farmer.ownerId} farmer={farmer} position={pos} tier={tier} />
          ))}
        </section>

        {/* Table */}
        <section className="flex flex-col gap-2">
          <RankingTable farmers={data.farmers} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-zinc-600">
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
      <footer className="relative flex items-center justify-between px-8 py-3 border-t border-zinc-800/60 text-xs text-zinc-600">
        <span>
          Dados: HubSpot &middot; Atualizado em {updatedStr}
          {error && <span className="text-orange-500 ml-3">(falha no último refresh)</span>}
        </span>
        <button onClick={load} className="text-zinc-500 hover:text-orange-400 transition-colors">
          Atualizar agora
        </button>
      </footer>
    </div>
  )
}
