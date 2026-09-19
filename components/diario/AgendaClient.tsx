'use client'

import { useCallback, useEffect, useState } from 'react'
import { BUCKETS, RESULTADOS, RESULTADOS_TRAMITACAO, Resultado } from '@/lib/diario/constants'
import type { ItemDiario } from '@/lib/diario/db'
import type { ResumoMes } from '@/lib/diario/metrics'
import { dataLonga, iniciais, meses, moeda } from './Marca'
import Cabecalho from './Cabecalho'

interface AgendaFarmer {
  farmerId: string
  nome: string
  timeLabel: string
  status: string
  comentarioLider: string | null
  itens: ItemDiario[]
  tramitacoes: Array<{
    ticketId: string
    tipo: string
    rotulo: string
    assunto: string
    resultado: string | null
    observacao: string | null
  }>
  auxilios: Array<{
    companyId: string
    companyName: string
    tentativas: number
    ultimaData: string
    naListaDeHoje: boolean
    orientacao: { texto: string; autor: string; criadoEm: string } | null
  }>
  placar: { total: number; extras: number; efetivo: number; tentativa: number; naoAbordei: number; pendente: number }
}

interface Dados {
  data: string
  agenda: AgendaFarmer[]
  resumo: ResumoMes
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  rascunho:  { texto: 'NÃO COMEÇOU',   cor: 'bg-zinc-200 text-zinc-600' },
  planejado: { texto: 'EM CAMPO',      cor: 'bg-blue-600 text-white' },
  fechado:   { texto: 'DIA FECHADO',   cor: 'bg-emerald-600 text-white' },
  revisado:  { texto: 'REVISADO',      cor: 'bg-zinc-900 text-white' },
}

const CORES_RESULTADO: Record<Resultado, string> = {
  efetivo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  tentativa: 'bg-amber-100 text-amber-800 border-amber-200',
  nao_abordei: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export default function AgendaClient({ usuario }: { usuario: { id: string; nome: string; papel?: string; timeKey?: string | null } }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [orientando, setOrientando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)

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

  async function revisa(farmerId: string) {
    if (!dados) return
    const comentario = window.prompt('Comentário para o farmer (opcional):') ?? ''
    await fetch('/api/diario/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'revisar', farmerId, data: dados.data, comentario }),
    })
    carrega()
  }

  // Um farmer pode ter só tramitações escolhidas e nenhuma empresa — ainda assim o dia dele começou.
  const temDia = (a: AgendaFarmer) => a.itens.length > 0 || a.tramitacoes.length > 0
  const comLista = dados?.agenda.filter(temDia) ?? []
  const semLista = dados?.agenda.filter((a) => !temDia(a)) ?? []
  const totalEmpresas = comLista.reduce((s, a) => s + a.placar.total, 0)
  const totalEfetivo = comLista.reduce((s, a) => s + a.placar.efetivo, 0)
  const totalPendente = comLista.reduce((s, a) => s + a.placar.pendente, 0)
  const comAuxilio = dados?.agenda.filter((a) => a.auxilios.length > 0) ?? []

  // Gerência enxerga os quatro times: agrupar evita uma parede de 24 cards soltos.
  const gerencia = usuario.timeKey === null || usuario.timeKey === undefined
  const porTime = gerencia
    ? Array.from(new Set(comLista.map((a) => a.timeLabel))).sort().map((time) => ({
        time,
        farmers: comLista.filter((a) => a.timeLabel === time),
      }))
    : [{ time: '', farmers: comLista }]

  async function orienta(farmerId: string, companyId: string) {
    if (!rascunho.trim()) return
    setSalvando(true)
    await fetch('/api/diario/orientacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerId, companyId, texto: rascunho }),
    })
    setSalvando(false)
    setOrientando(null)
    setRascunho('')
    carrega()
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <Cabecalho
        titulo="Agenda do dia"
        subtitulo={
          dados
            ? `${dataLonga(dados.data)} · ${comLista.length} de ${dados.agenda.length} farmers · ${totalEmpresas} empresas · ${totalEfetivo} contatos efetivos`
            : 'carregando...'
        }
        usuario={{ ...usuario, papel: 'lider' }}
        ativa="agenda"
      />

      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{erro}</div>}

      {dados && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Cartao titulo="Oportunidades no mês" valor={String(dados.resumo.oportunidadesCriadas)} rodape="do time inteiro" />
          <Cartao titulo="Tickets ativos" valor={String(dados.resumo.ticketsAtivos)} rodape="eventos em execução no CS" />
          <Cartao titulo="Receita gerada" valor={moeda(dados.resumo.receitaGerada)} rodape="negócios ganhos no mês" cor="#FF5200" />
          <Cartao titulo="Contato efetivo" valor={`${dados.resumo.pctContatoEfetivo}%`} rodape={`${dados.resumo.empresasComContatoEfetivo} de ${dados.resumo.carteira} empresas`} />
        </div>
      )}

      {semLista.length > 0 && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Sem lista hoje ({semLista.length})</span>
          {semLista.map((a) => (
            <span key={a.farmerId} className="flex items-center gap-2 text-sm bg-zinc-50 border border-zinc-200 rounded-full pl-1.5 pr-3 py-1">
              <span className="w-6 h-6 rounded-full bg-zinc-300 text-zinc-700 text-[10px] font-bold grid place-items-center">{iniciais(a.nome)}</span>
              {a.nome}
            </span>
          ))}
        </div>
      )}

      {comAuxilio.length > 0 && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/50 px-5 py-4">
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-orange-800">Pedidos de auxílio</h2>
            <span className="text-xs text-orange-700">
              {(() => {
                const n = comAuxilio.reduce((s, a) => s + a.auxilios.length, 0)
                return `${n} ${n === 1 ? 'empresa' : 'empresas'} com 3 tentativas sem contato`
              })()}
            </span>
          </div>
          <p className="text-xs text-orange-700/80 mb-4">
            Elas continuam na lista do farmer. Escreva a orientação e ela aparece no card da empresa para ele.
          </p>

          <div className="grid gap-3">
            {comAuxilio.map((a) => (
              <div key={a.farmerId}>
                <p className="text-xs font-semibold text-zinc-600 mb-1.5">{a.nome}</p>
                <div className="grid gap-2">
                  {a.auxilios.map((p) => {
                    const chave = `${a.farmerId}:${p.companyId}`
                    const editando = orientando === chave
                    return (
                      <div key={p.companyId} className="rounded-xl bg-white border border-orange-200 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://app.hubspot.com/contacts/49656171/record/0-2/${p.companyId}`}
                              target="_blank" rel="noreferrer"
                              className="text-sm font-medium hover:text-orange-600 hover:underline"
                            >
                              {p.companyName}
                            </a>
                            <span className="text-[11px] text-zinc-500">
                              {p.tentativas} tentativas · última em {p.ultimaData.slice(8, 10)}/{p.ultimaData.slice(5, 7)}
                            </span>
                            {p.naListaDeHoje && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900 text-white">NA LISTA DE HOJE</span>
                            )}
                          </div>
                          <button
                            onClick={() => { setOrientando(editando ? null : chave); setRascunho(p.orientacao?.texto ?? '') }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:border-zinc-500"
                          >
                            {editando ? 'Cancelar' : p.orientacao ? 'Editar orientação' : 'Orientar'}
                          </button>
                        </div>

                        {p.orientacao && !editando && (
                          <p className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 mt-2">
                            <b>{p.orientacao.autor}:</b> {p.orientacao.texto}
                          </p>
                        )}

                        {editando && (
                          <div className="mt-2">
                            <textarea
                              value={rascunho}
                              onChange={(e) => setRascunho(e.target.value)}
                              rows={2}
                              autoFocus
                              placeholder="Ex.: falei com o Ricardo lá, procura a Ana no RH e usa meu nome"
                              className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm resize-y"
                            />
                            <button
                              onClick={() => orienta(a.farmerId, p.companyId)}
                              disabled={salvando || !rascunho.trim()}
                              className="mt-2 text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:bg-zinc-300"
                              style={rascunho.trim() && !salvando ? { background: '#FF5200' } : undefined}
                            >
                              {salvando ? 'Salvando...' : 'Enviar para o farmer'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPendente > 0 && comLista.length > 0 && (
        <p className="mb-4 text-sm text-zinc-500">{totalPendente} empresa(s) ainda sem resultado registrado no time.</p>
      )}

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando a agenda do time...</p>
      ) : comLista.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Nenhum farmer abriu o diário hoje.</p>
      ) : (
        porTime.map((grupo) => (
        <section key={grupo.time} className="mb-8 last:mb-0">
          {grupo.time && (
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{grupo.time}</h2>
              <span className="text-xs text-zinc-400">
                {grupo.farmers.length} {grupo.farmers.length === 1 ? 'farmer' : 'farmers'} em campo ·{' '}
                {grupo.farmers.reduce((s, a) => s + a.placar.efetivo, 0)} contatos efetivos
              </span>
            </div>
          )}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {grupo.farmers.map((a) => {
            const status = ROTULO_STATUS[a.status] ?? ROTULO_STATUS.rascunho
            const expandido = aberto === a.farmerId
            const visiveis = expandido ? a.itens : a.itens.filter((i) => i.resultado)
            return (
              <div key={a.farmerId} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-zinc-900 text-white text-xs font-bold grid place-items-center">{iniciais(a.nome)}</span>
                    <div>
                      <p className="font-semibold text-sm">{a.nome}</p>
                      <p className="text-xs text-zinc-500">
                        {a.placar.total} empresas{a.placar.extras > 0 && ` + ${a.placar.extras} extras`}
                        {a.tramitacoes.length > 0 &&
                          ` · ${a.tramitacoes.length} ${a.tramitacoes.length === 1 ? 'tramitação' : 'tramitações'}`}
                        {' · '}{a.timeLabel}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded ${status.cor}`}>{status.texto}</span>
                </div>

                {a.placar.total > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 text-xs">
                  <Placar rotulo="efetivos" valor={a.placar.efetivo} cor="text-emerald-700 bg-emerald-50 border-emerald-100" />
                  <Placar rotulo="tentativas" valor={a.placar.tentativa} cor="text-amber-700 bg-amber-50 border-amber-100" />
                  <Placar rotulo="não abordou" valor={a.placar.naoAbordei} cor="text-zinc-600 bg-zinc-50 border-zinc-200" />
                  {a.placar.pendente > 0 && <Placar rotulo="sem resposta" valor={a.placar.pendente} cor="text-zinc-400 bg-white border-zinc-200" />}
                </div>
                )}

                {a.comentarioLider && (
                  <p className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-900">{a.comentarioLider}</p>
                )}

                <div className="divide-y divide-zinc-50 flex-1">
                  {visiveis.length === 0 ? (
                    a.placar.total > 0
                      ? <p className="px-4 py-6 text-xs text-zinc-400 text-center">Nada registrado ainda.</p>
                      : null
                  ) : visiveis.map((i) => (
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
                        {i.abordagem && (
                          <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded">
                            {i.abordagem}
                          </span>
                        )}
                        {i.resultado && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${CORES_RESULTADO[i.resultado as Resultado]}`}>
                            {RESULTADOS.find((r) => r.key === i.resultado)?.label}
                          </span>
                        )}
                      </div>
                      {i.observacaoResultado && <p className="text-xs text-zinc-700 mt-2 border-l-2 border-emerald-300 pl-2">{i.observacaoResultado}</p>}
                      {!i.observacaoResultado && i.observacao && <p className="text-xs text-zinc-500 mt-2 border-l-2 border-zinc-200 pl-2">{i.observacao}</p>}
                    </div>
                  ))}
                </div>

                {a.tramitacoes.length > 0 && (
                  <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/40">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-2">
                      {a.tramitacoes.length === 1 ? 'Tramitação de hoje' : `Tramitações de hoje · ${a.tramitacoes.length}`}
                    </p>
                    <div className="grid gap-2">
                      {a.tramitacoes.map((t) => (
                        <div key={`${t.ticketId}:${t.tipo}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                              {t.rotulo}
                            </span>
                            <a
                              href={`https://app.hubspot.com/contacts/49656171/record/0-5/${t.ticketId}`}
                              target="_blank" rel="noreferrer"
                              className="text-xs font-medium hover:text-orange-600 hover:underline truncate"
                            >
                              {t.assunto}
                            </a>
                            {t.resultado && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                t.resultado === 'resolvi' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : t.resultado === 'avancei' ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                {RESULTADOS_TRAMITACAO.find((r) => r.key === t.resultado)?.label}
                              </span>
                            )}
                          </div>
                          {t.observacao && (
                            <p className="text-xs text-zinc-600 mt-1 border-l-2 border-zinc-200 pl-2">{t.observacao}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 px-4 py-3 border-t border-zinc-100 bg-zinc-50/60">
                  {a.placar.total > 0 && (
                    <button onClick={() => setAberto(expandido ? null : a.farmerId)}
                      className="flex-1 rounded-lg py-2 text-sm font-medium border border-zinc-300 bg-white hover:border-zinc-500">
                      {expandido ? 'Ver só o que rolou' : `Ver as ${a.placar.total}`}
                    </button>
                  )}
                  {a.status === 'fechado' && (
                    <button onClick={() => revisa(a.farmerId)}
                      className="flex-1 rounded-lg py-2 text-sm font-semibold text-white" style={{ background: '#FF5200' }}>
                      Revisar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </section>
        ))
      )}
    </div>
  )
}

function Placar({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <span className={`px-2 py-1 rounded border font-medium ${cor}`}>
      {valor} {rotulo}
    </span>
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
