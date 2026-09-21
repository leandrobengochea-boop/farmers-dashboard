'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface Composicao {
  setadas: number
  efetivo: number
  tentativa: number
  naoAbordei: number
  semRegistro: number
  trocaSegmento: number
  pctEfetivo: number
}

type DiaComposto = Composicao & { data: string }

interface Dados {
  de: string
  ate: string
  dias: DiaComposto[]
  total: Composicao
  times: Array<{ timeKey: string; lider: string; total: Composicao; dias: DiaComposto[] }>
}

/**
 * As quatro faixas somam as empresas setadas do dia. O verde é o número que
 * interessa; o resto existe para explicar por que ele é o que é.
 */
const FAIXAS = [
  { chave: 'efetivo',     rotulo: 'Contato efetivo', cor: '#059669' },
  { chave: 'tentativa',   rotulo: 'Tentativa',       cor: '#fbbf24' },
  { chave: 'naoAbordei',  rotulo: 'Não abordei',     cor: '#a1a1aa' },
  { chave: 'semRegistro', rotulo: 'Sem registro',    cor: '#e4e4e7' },
] as const

const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

/** Barra fina de 100%, usada na comparação entre times. */
function BarraComposta({ c }: { c: Composicao }) {
  if (c.setadas === 0) return <div className="h-2.5 rounded-full bg-zinc-100" />
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-100">
      {FAIXAS.map((f) => {
        const v = c[f.chave]
        if (v === 0) return null
        return <div key={f.chave} style={{ width: `${(v / c.setadas) * 100}%`, background: f.cor }} title={`${f.rotulo}: ${v}`} />
      })}
    </div>
  )
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {FAIXAS.map((f) => (
        <span key={f.chave} className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: f.cor }} />
          {f.rotulo}
        </span>
      ))}
    </div>
  )
}

interface PontoTooltip { payload: DiaComposto }

function Dica({ active, payload }: { active?: boolean; payload?: PontoTooltip[] }) {
  const d = active ? payload?.[0]?.payload : null
  if (!d) return null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold mb-1.5">{diaCurto(d.data)} · {d.setadas} empresas setadas</p>
      {FAIXAS.map((f) => (
        <p key={f.chave} className="flex items-center gap-1.5 text-zinc-600">
          <span className="w-2 h-2 rounded-sm" style={{ background: f.cor }} />
          {f.rotulo}: <b className="text-zinc-900">{d[f.chave]}</b> ({pct(d[f.chave], d.setadas)}%)
        </p>
      ))}
      {d.trocaSegmento > 0 && (
        <p className="text-red-700 mt-1.5 pt-1.5 border-t border-zinc-100">
          + {d.trocaSegmento} fora da conta: segmento errado
        </p>
      )}
    </div>
  )
}

export default function Evolucao({ timeFiltro, souLider }: { timeFiltro: string | null; souLider: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [dias, setDias] = useState(14)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    fetch(`/api/diario/evolucao?dias=${dias}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelado) setDados(d) })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [dias])

  const doTime = timeFiltro ? dados?.times.find((t) => t.timeKey === timeFiltro) : null
  const serie = doTime ? doTime.dias : dados?.dias ?? []
  const total = doTime ? doTime.total : dados?.total

  // Barras normalizadas: o dia com 20 empresas precisa ser comparável ao de 460.
  const grafico = serie.map((d) => ({
    ...d,
    pEfetivo: pct(d.efetivo, d.setadas),
    pTentativa: pct(d.tentativa, d.setadas),
    pNaoAbordei: pct(d.naoAbordei, d.setadas),
    pSemRegistro: pct(d.semRegistro, d.setadas),
  }))

  if (carregando) return <p className="py-16 text-center text-sm text-zinc-500">Somando os dias...</p>
  if (!total || serie.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-500">Ainda não há dias com lista montada no período.</p>
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Contato efetivo sobre as empresas setadas
            </p>
            <p className="text-4xl font-black tracking-tight mt-1" style={{ color: '#059669' }}>
              {total.pctEfetivo}%
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {total.efetivo} de {total.setadas} empresas · {serie.length} {serie.length === 1 ? 'dia' : 'dias'}
              {doTime && ` · time de ${doTime.lider.split(' ')[0]}`}
            </p>
          </div>
          <div className="flex rounded-full bg-zinc-100 p-1">
            {[7, 14, 30].map((n) => (
              <button
                key={n}
                onClick={() => setDias(n)}
                className={`px-3 py-1 text-xs rounded-full transition ${dias === n ? 'bg-white shadow-sm font-medium' : 'text-zinc-500'}`}
              >
                {n} dias
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={grafico} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="28%">
              <XAxis dataKey="data" tickFormatter={diaCurto} tickLine={false} axisLine={false}
                tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tickLine={false}
                axisLine={false} tick={{ fontSize: 11, fill: '#d4d4d8' }} width={38} />
              <Tooltip content={<Dica />} cursor={{ fill: '#fafafa' }} />
              <Bar dataKey="pEfetivo" stackId="a" fill="#059669" isAnimationActive={false} />
              <Bar dataKey="pTentativa" stackId="a" fill="#fbbf24" isAnimationActive={false} />
              <Bar dataKey="pNaoAbordei" stackId="a" fill="#a1a1aa" isAnimationActive={false} />
              <Bar dataKey="pSemRegistro" stackId="a" fill="#e4e4e7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-100">
          <Legenda />
        </div>
      </div>

      {souLider && (dados?.times.length ?? 0) > 0 && !timeFiltro && (
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-4">
            Por time · {dias} dias
          </p>
          <div className="grid gap-3.5">
            {[...(dados?.times ?? [])]
              .sort((a, b) => b.total.pctEfetivo - a.total.pctEfetivo)
              .map((t) => (
                <div key={t.timeKey} className="grid grid-cols-[110px_1fr_auto] items-center gap-4">
                  <span className="text-sm font-medium truncate">{t.lider.split(' ')[0]}</span>
                  <BarraComposta c={t.total} />
                  <span className="text-sm tabular-nums">
                    <b style={{ color: '#059669' }}>{t.total.pctEfetivo}%</b>
                    <span className="text-zinc-400 text-xs"> de {t.total.setadas}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
