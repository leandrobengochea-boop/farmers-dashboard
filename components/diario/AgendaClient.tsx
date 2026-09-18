'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUCKETS } from '@/lib/diario/constants'
import type { ItemDiario } from '@/lib/diario/db'
import type { ResumoMes } from '@/lib/diario/metrics'
import { LogoPSA, dataLonga, iniciais, meses, moeda } from './Marca'

interface AgendaFarmer {
  farmerId: string
  nome: string
  timeLabel: string
  status: string
  itens: ItemDiario[]
}

interface Dados {
  data: string
  agenda: AgendaFarmer[]
  resumo: ResumoMes
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  rascunho: { texto: 'SEM BRIEFING', cor: 'bg-zinc-200 text-zinc-600' },
  enviado: { texto: 'AGUARDANDO', cor: 'bg-blue-600 text-white' },
  aprovado: { texto: 'APROVADO', cor: 'bg-emerald-600 text-white' },
  ajustar: { texto: 'AJUSTAR', cor: 'bg-amber-500 text-white' },
}

export default function AgendaClient({ usuario }: { usuario: { id: string; nome: string } }) {
  const router = useRouter()
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carrega = useCallback(async () => {
    setCarregando(true)
    const resp = await fetch('/api/diario/agenda', { cache: 'no-store' })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({ error: 'falha ao carregar' }))
      setErro(d.error ?? 'falha ao carregar')
      setCarregando(false)
      return
    }
    setDados(await resp.json())
    setCarregando(false)
  }, [])

  useEffect(() => { carrega() }, [carrega])

  async function decide(farmerId: string, acao: 'aprovar' | 'ajustar') {
    if (!dados) return
    const comentario = acao === 'ajustar' ? window.prompt('O que precisa mudar no plano?') ?? '' : ''
    await fetch('/api/diario/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, farmerId, data: dados.data, comentario }),
    })
    carrega()
  }

  async function sair() {
    await fetch('/api/diario/logout', { method: 'POST' })
    router.push('/diario/login')
    router.refresh()
  }

  const comBriefing = dados?.agenda.filter((a) => a.itens.length > 0) ?? []
  const semBriefing = dados?.agenda.filter((a) => a.itens.length === 0) ?? []
  const totalEmpresas = comBriefing.reduce((s, a) => s + a.itens.length, 0)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <header className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <LogoPSA />
          <div>
            <h1 className="font-black tracking-tight text-2xl uppercase leading-none">Agenda do dia</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {dados ? `${dataLonga(dados.data)} · ${comBriefing.length} de ${dados.agenda.length} farmers · ${totalEmpresas} empresas` : 'carregando...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/diario" className="text-sm px-4 py-2 rounded-full bg-white border border-zinc-200 hover:border-zinc-400">Diário de bordo</a>
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full pl-1.5 pr-4 py-1.5">
            <span className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold grid place-items-center">{iniciais(usuario.nome)}</span>
            <span className="text-sm font-medium">{usuario.nome}</span>
          </div>
          <button onClick={sair} className="text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-2">Sair</button>
        </div>
      </header>

      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{erro}</div>}

      {dados && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Cartao titulo="Oportunidades no mês" valor={String(dados.resumo.oportunidadesCriadas)} rodape="do time inteiro" />
          <Cartao titulo="Tickets ativos" valor={String(dados.resumo.ticketsAtivos)} rodape="eventos em execução no CS" />
          <Cartao titulo="Receita gerada" valor={moeda(dados.resumo.receitaGerada)} rodape="negócios ganhos no mês" cor="#FF5200" />
          <Cartao titulo="Contato efetivo" valor={`${dados.resumo.pctContatoEfetivo}%`} rodape={`${dados.resumo.empresasComContatoEfetivo} de ${dados.resumo.carteira} empresas`} />
        </div>
      )}

      {semBriefing.length > 0 && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Sem briefing hoje ({semBriefing.length})</span>
          {semBriefing.map((a) => (
            <span key={a.farmerId} className="flex items-center gap-2 text-sm bg-zinc-50 border border-zinc-200 rounded-full pl-1.5 pr-3 py-1">
              <span className="w-6 h-6 rounded-full bg-zinc-300 text-zinc-700 text-[10px] font-bold grid place-items-center">{iniciais(a.nome)}</span>
              {a.nome}
            </span>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando a agenda do time...</p>
      ) : comBriefing.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Nenhum farmer montou o plano do dia ainda.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {comBriefing.map((a) => {
            const status = ROTULO_STATUS[a.status] ?? ROTULO_STATUS.rascunho
            return (
              <div key={a.farmerId} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-zinc-900 text-white text-xs font-bold grid place-items-center">{iniciais(a.nome)}</span>
                    <div>
                      <p className="font-semibold text-sm">{a.nome}</p>
                      <p className="text-xs text-zinc-500">{a.itens.length} empresas · {a.timeLabel}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded ${status.cor}`}>{status.texto}</span>
                </div>

                <div className="divide-y divide-zinc-50">
                  {a.itens.map((i) => (
                    <div key={i.companyId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <a href={`https://app.hubspot.com/contacts/49656171/record/0-2/${i.companyId}`} target="_blank" rel="noreferrer"
                          className="text-sm font-medium hover:text-orange-600 hover:underline">
                          {i.companyName}
                        </a>
                        <span className="text-[11px] text-zinc-400 shrink-0">{meses(i.diasDesdeCompra)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                          {BUCKETS[i.bucket as keyof typeof BUCKETS]?.label ?? i.bucket}
                        </span>
                        <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded">
                          {i.abordagem}
                        </span>
                      </div>
                      {i.observacao && <p className="text-xs text-zinc-600 mt-2 border-l-2 border-zinc-200 pl-2">{i.observacao}</p>}
                    </div>
                  ))}
                </div>

                {a.status === 'enviado' && (
                  <div className="flex gap-2 px-4 py-3 border-t border-zinc-100 bg-zinc-50/60">
                    <button onClick={() => decide(a.farmerId, 'aprovar')}
                      className="flex-1 rounded-lg py-2 text-sm font-semibold text-white" style={{ background: '#FF5200' }}>
                      Aprovar
                    </button>
                    <button onClick={() => decide(a.farmerId, 'ajustar')}
                      className="flex-1 rounded-lg py-2 text-sm font-semibold border border-zinc-300 bg-white hover:border-zinc-500">
                      Pedir ajuste
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Cartao({ titulo, valor, rodape, cor }: { titulo: string; valor: string; rodape: string; cor?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{titulo}</p>
      <p className="text-3xl font-black tracking-tight mt-1.5" style={cor ? { color: cor } : undefined}>{valor}</p>
      <p className="text-xs text-zinc-400 mt-1">{rodape}</p>
    </div>
  )
}
