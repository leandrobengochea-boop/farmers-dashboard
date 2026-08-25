'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SalaoData, SalaoFarmerData } from '@/lib/salao'

const REFRESH_MS = 5 * 60 * 1000

const MONTHS_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}

function fmtBRL(v: number) {
  if (!v) return '—'
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace('.', ',')}M`
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3)}k`
  return `R$ ${v}`
}

function monthLabel(m: string) {
  const [y, mm] = m.split('-')
  return `${MONTHS_PT[mm] ?? mm} ${y}`
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/* ═══════════════════ Podium Card ═══════════════════ */

const PODIUM_STYLES = {
  1: {
    w: 'w-[260px]',
    border: 'border-amber-400/40',
    glow: 'shadow-[0_0_60px_-8px_rgba(251,191,36,0.22)]',
    grad: 'from-amber-400/10 to-amber-500/5',
    accent: 'text-amber-400',
    num: 'text-[48px]',
    avatar: 'w-10 h-10 text-sm border-amber-400/50',
    barH: 'h-8',
    barGrad: 'from-amber-400/25 to-amber-400/5 border-amber-400/25',
    medal: 'text-2xl',
    name: 'text-[14px]',
    valor: 'text-[13px]',
  },
  2: {
    w: 'w-[230px]',
    border: 'border-zinc-400/25',
    glow: '',
    grad: 'from-zinc-400/10 to-zinc-500/5',
    accent: 'text-zinc-300',
    num: 'text-[40px]',
    avatar: 'w-9 h-9 text-xs border-zinc-400/35',
    barH: 'h-5',
    barGrad: 'from-zinc-400/15 to-zinc-400/5 border-zinc-400/15',
    medal: 'text-xl',
    name: 'text-[13px]',
    valor: 'text-xs',
  },
  3: {
    w: 'w-[220px]',
    border: 'border-amber-700/25',
    glow: '',
    grad: 'from-amber-700/10 to-amber-700/5',
    accent: 'text-amber-600',
    num: 'text-[36px]',
    avatar: 'w-9 h-9 text-xs border-amber-700/35',
    barH: 'h-3',
    barGrad: 'from-amber-700/15 to-amber-700/5 border-amber-700/15',
    medal: 'text-xl',
    name: 'text-[13px]',
    valor: 'text-xs',
  },
} as const

function PodiumCard({ farmer, rank }: { farmer: SalaoFarmerData; rank: 1 | 2 | 3 }) {
  const s = PODIUM_STYLES[rank]
  return (
    <div className={`flex flex-col ${s.w}`}>
      <div className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-t-2xl border border-b-0 bg-gradient-to-b backdrop-blur-sm ${s.border} ${s.glow} ${s.grad}`}>
        <span className={`${s.medal} leading-none`}>{MEDAL[rank]}</span>
        <div className={`${s.avatar} rounded-full flex items-center justify-center font-bold tracking-wider border-2 bg-zinc-950 ${s.accent}`}>
          {farmer.initials}
        </div>
        <span className={`${s.name} font-semibold text-zinc-100 truncate max-w-full leading-snug mt-0.5`}>
          {farmer.name}
        </span>
        <span className={`${s.num} font-black tabular-nums leading-none ${s.accent}`}>
          {farmer.deals}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[.3em] text-zinc-500">
          empresas
        </span>
        {farmer.valor > 0 && (
          <span className={`${s.valor} font-semibold opacity-60 ${s.accent}`}>
            {fmtBRL(farmer.valor)}
          </span>
        )}
      </div>
      <div className={`w-full ${s.barH} bg-gradient-to-t ${s.barGrad} rounded-b-xl border border-t-0`} />
    </div>
  )
}

/* ═══════════════════ Ranking Column (flex-based) ═══════════════════ */

const COL_GRID = 'grid grid-cols-[48px_1fr_56px_80px_48px_48px_48px_48px] items-center'

function RankingColumn({ farmers }: { farmers: SalaoFarmerData[] }) {
  return (
    <div className="flex-1 flex flex-col border border-zinc-800/40 rounded-xl bg-zinc-900/20 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={`${COL_GRID} bg-zinc-800/25 shrink-0 px-3`}>
        {['#', 'Farmer', 'Emp', 'Val', 'RR', 'RA', 'CE', 'TC'].map((h, i) => (
          <span key={h} className={`py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 ${
            i === 0 ? 'text-center' :
            i === 1 ? 'text-left' :
            i === 3 ? 'text-right' : 'text-center'
          }`}>{h}</span>
        ))}
      </div>

      {/* Rows — each flex-1 fills height evenly */}
      <div className="flex-1 flex flex-col min-h-0">
        {farmers.map((f, i) => {
          const top3 = f.rank <= 3
          const rc =
            f.rank === 1 ? 'text-amber-400' :
            f.rank === 2 ? 'text-zinc-300' :
            f.rank === 3 ? 'text-amber-600' : 'text-zinc-600'

          const avatarCls =
            f.rank === 1 ? 'border-amber-400/40 text-amber-400' :
            f.rank === 2 ? 'border-zinc-400/30 text-zinc-300' :
            f.rank === 3 ? 'border-amber-700/30 text-amber-600' :
            'border-zinc-800 text-zinc-600'

          const rowBg = top3
            ? 'bg-orange-400/[0.03]'
            : i % 2 === 0 ? 'bg-white/[0.01]' : ''

          return (
            <div
              key={f.ownerId}
              className={`flex-1 ${COL_GRID} px-3 border-b border-zinc-800/25 last:border-b-0 min-h-0 tabular-nums ${rowBg}`}
            >
              {/* Rank */}
              <span className={`text-center text-base font-bold ${rc}`}>
                {MEDAL[f.rank] ?? f.rank}
              </span>

              {/* Farmer */}
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider shrink-0 border bg-zinc-950 ${avatarCls}`}>
                  {f.initials}
                </div>
                <span className={`text-lg truncate ${top3 ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`}>
                  {f.name}
                </span>
              </div>

              {/* Emp */}
              <span className={`text-center font-bold ${top3 ? 'text-orange-400 text-xl' : 'text-zinc-200 text-base'}`}>
                {f.deals}
              </span>

              {/* Val */}
              <span className={`text-right text-sm whitespace-nowrap ${f.valor > 0 ? 'text-zinc-300 font-medium' : 'text-zinc-700'}`}>
                {fmtBRL(f.valor)}
              </span>

              {/* RR */}
              <span className="text-center text-sm text-zinc-500">{f.meetingsHeld}</span>
              {/* RA */}
              <span className="text-center text-sm text-zinc-500">{f.meetingsScheduled}</span>
              {/* CE */}
              <span className="text-center text-sm text-zinc-500">{f.effectiveContacts}</span>
              {/* TC */}
              <span className="text-center text-sm text-zinc-500">{f.contactAttempts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════ Main Page ═══════════════════ */

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
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(() => window.location.reload(), REFRESH_MS)
    return () => clearInterval(iv)
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-orange-400/50 text-xl animate-pulse">Carregando ranking...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button onClick={load} className="px-5 py-2.5 text-base bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const top3 = data.farmers.slice(0, 3)
  const mid = Math.ceil(data.farmers.length / 2)

  const totalValor = data.farmers.reduce((sum, f) => sum + f.valor, 0)
  const ts = new Date(data.updatedAt)
  const hhmm = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      <style>{`
        @keyframes amb{0%,100%{opacity:.3}50%{opacity:.55}}
        @keyframes ring{0%{transform:scale(1);opacity:1}100%{transform:scale(2.5);opacity:0}}
      `}</style>

      {/* Ambient background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-orange-500/[0.03] rounded-full blur-[160px] pointer-events-none"
        style={{ animation: 'amb 8s ease-in-out infinite' }}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-3 border-b border-zinc-800/30 shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🏆</span>
          <h1 className="text-2xl font-black tracking-[.16em] uppercase bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
            Ranking Farmers
          </h1>
          <span className="text-base text-zinc-500 font-medium">{monthLabel(data.month)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-orange-400/80 bg-orange-400/[0.08] border border-orange-400/[0.12] px-3.5 py-1 rounded-full tabular-nums">
            {data.daysLeft} dias restantes
          </span>
          <div className="relative w-2.5 h-2.5">
            <div className="absolute inset-0 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 rounded-full bg-emerald-400" style={{ animation: 'ring 2s ease-out infinite' }} />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 px-6 py-3 gap-3 relative z-10">
        {/* Podium — top 3 */}
        <section className="flex items-end justify-center gap-4 shrink-0">
          {top3.length >= 3 && (
            <>
              <PodiumCard farmer={top3[1]} rank={2} />
              <PodiumCard farmer={top3[0]} rank={1} />
              <PodiumCard farmer={top3[2]} rank={3} />
            </>
          )}
        </section>

        {/* Two-column ranking */}
        <section className="flex-1 flex gap-4 min-h-0">
          <RankingColumn farmers={data.farmers.slice(0, mid)} />
          <RankingColumn farmers={data.farmers.slice(mid)} />
        </section>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-8 py-2 border-t border-zinc-800/30 text-xs text-zinc-600 shrink-0 relative z-10">
        <div className="flex gap-4">
          <span>Emp = Empresas únicas</span>
          <span>Val = Valor fechado</span>
          <span>RR = Reu. realizadas</span>
          <span>RA = Reu. agendadas</span>
          <span>CE = Contatos efetivos</span>
          <span>TC = Tentativas</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-amber-400">
            Total vendido: {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span>
            Atualizado {hhmm}
            {error && <span className="text-orange-400 ml-2">(falha)</span>}
          </span>
        </div>
      </footer>
    </div>
  )
}
