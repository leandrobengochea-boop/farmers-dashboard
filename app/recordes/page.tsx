'use client'

import { useEffect, useState, useCallback } from 'react'
import type { RecordesData, MetricRecord, MonthlyRow } from '@/lib/recordes'

const MONTHS_FULL: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}

function monthFull(m: string): string {
  const [, mm] = m.split('-')
  return MONTHS_FULL[mm] ?? m
}

function fmtValue(key: string, v: number): string {
  if (key === 'valor') {
    if (!v) return 'R$ 0'
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  return v.toLocaleString('pt-BR')
}

const METRIC_ICONS: Record<string, string> = {
  deals: '\u{1F4BC}',
  valor: '\u{1F4B0}',
  meetingsHeld: '\u{1F91D}',
  meetingsScheduled: '\u{1F4C5}',
  effectiveContacts: '\u{1F4DE}',
  contactAttempts: '\u{1F4E2}',
}

const METRIC_SHORT: Record<string, string> = {
  deals: 'Neg',
  valor: 'Valor',
  meetingsHeld: 'Reu.R',
  meetingsScheduled: 'Reu.A',
  effectiveContacts: 'CE',
  contactAttempts: 'TC',
}

function RecordCard({ record, index }: { record: MetricRecord; index: number }) {
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
          <span className="text-[11px] uppercase tracking-[.15em] font-semibold text-zinc-400">
            {record.label}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold tracking-wide border-2 bg-zinc-900 border-yellow-500 text-yellow-400">
            {first.initials}
          </div>
          <span className="text-sm font-semibold text-zinc-100">{first.name}</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-3xl font-extrabold text-yellow-400 tabular-nums">
            {fmtValue(record.key, first.value)}
          </span>
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
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
              Mês
            </th>
            {metricKeys.map((k) => (
              <th
                key={k}
                className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap"
              >
                {METRIC_SHORT[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthly.map((row, i) => (
            <tr key={row.month} className={`border-b border-zinc-800 last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
              <td className="px-4 py-2.5 font-medium text-zinc-300 whitespace-nowrap">
                {row.label}
              </td>
              {metricKeys.map((k) => {
                const best = row.bests[k]
                if (!best || best.value <= 0) {
                  return <td key={k} className="px-3 py-2.5 text-center text-zinc-700">—</td>
                }
                return (
                  <td key={k} className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-zinc-200 tabular-nums">
                        {fmtValue(k, best.value)}
                      </span>
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

export default function RecordesPage() {
  const [data, setData] = useState<RecordesData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/recordes${force ? '?force=1' : ''}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = (await resp.json()) as RecordesData
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-zinc-500 text-lg animate-pulse">Carregando recordes do HubSpot...</div>
        <div className="text-zinc-600 text-xs">Primeira carga pode levar até 60 segundos</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <button
          onClick={() => load(true)}
          className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const metricKeys = data.records.map((r) => r.key)

  const ts = new Date(data.updatedAt)
  const updatedStr = `${String(ts.getDate()).padStart(2, '0')}/${String(ts.getMonth() + 1).padStart(2, '0')}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-extrabold tracking-[.12em] uppercase">
            Hall da Fama
          </h1>
          <span className="text-base text-zinc-400 font-medium">{data.year}</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Recordes mensais dos Farmers PSA
        </span>
      </header>

      <main className="flex-1 flex flex-col gap-8 px-8 py-6 overflow-auto">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.records.map((rec, i) => (
            <RecordCard key={rec.key} record={rec} index={i} />
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Melhores do mês
          </h2>
          <MonthlyTable monthly={data.monthly} metricKeys={metricKeys} />
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

      <footer className="flex items-center justify-between px-8 py-3 border-t border-zinc-800 text-xs text-zinc-500">
        <span>
          Dados: HubSpot &middot; Atualizado em {updatedStr}
          {loading && <span className="text-yellow-500 ml-3">(atualizando...)</span>}
          {error && <span className="text-yellow-500 ml-3">(falha no último refresh)</span>}
        </span>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          Recalcular
        </button>
      </footer>
    </div>
  )
}
