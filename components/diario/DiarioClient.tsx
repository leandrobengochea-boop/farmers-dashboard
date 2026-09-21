'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ABORDAGEM_PADRAO, ABORDAGENS, Bucket, BUCKETS, COTA_DIARIA, MINIMO_OBSERVACAO,
  ORDEM_BUCKET, RESULTADOS, RESULTADO_EXIGE_OBSERVACAO, Resultado,
} from '@/lib/diario/constants'
import type { Briefing, ItemDiario } from '@/lib/diario/db'
import type { PoolCarteira, ResumoMes } from '@/lib/diario/metrics'
import { dataLonga, meses, moeda, dataCurta } from './Marca'
import Cabecalho from './Cabecalho'

interface Props {
  usuario: { id: string; nome: string; papel: string; timeKey: string | null }
  farmers: Array<{ id: string; nome: string }>
}

export interface HistoricoItem {
  aparicoes: number
  ultimaData: string
  ultimoResultado: string | null
  tentativasSeguidas: number
}

export interface OrientacaoItem {
  texto: string
  autor: string
  criadoEm: string
}

export interface AtividadeItem {
  ligacoes: number
  conectadas: number
  reunioes: number
  outras: number
  texto: string
  resultadoSugerido: 'efetivo' | 'tentativa' | null
}

export type ItemComHistorico = ItemDiario & {
  historico: HistoricoItem | null
  precisaAuxilio: boolean
  seloRelacionamento: boolean
  orientacao: OrientacaoItem | null
  atividade: AtividadeItem | null
}

interface Dados {
  farmerId: string
  data: string
  itens: ItemComHistorico[]
  pool: (PoolCarteira & { emDescanso: number; precisandoAuxilio: number }) | null
  resumo: ResumoMes
  briefing: Briefing
}

const CORES_BUCKET: Record<string, string> = {
  recompra: 'bg-orange-100 text-orange-800 border-orange-200',
  nutricao: 'bg-violet-100 text-violet-800 border-violet-200',
  reativacao: 'bg-blue-100 text-blue-800 border-blue-200',
  extra: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  primeiro_contato: 'bg-zinc-100 text-zinc-700 border-zinc-200',
}

const CORES_RESULTADO: Record<Resultado, { ativo: string; badge: string }> = {
  efetivo:     { ativo: 'bg-emerald-600 text-white border-emerald-600', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  tentativa:   { ativo: 'bg-amber-500 text-white border-amber-500',     badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  nao_abordei: { ativo: 'bg-zinc-700 text-white border-zinc-700',       badge: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  rascunho:  { texto: 'PLANO ABERTO',      cor: 'bg-zinc-200 text-zinc-700' },
  planejado: { texto: 'PLANO CONFIRMADO',  cor: 'bg-blue-600 text-white' },
  fechado:   { texto: 'DIA FECHADO',       cor: 'bg-emerald-600 text-white' },
  revisado:  { texto: 'REVISADO PELO LÍDER', cor: 'bg-zinc-900 text-white' },
}

export default function DiarioClient({ usuario, farmers }: Props) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [farmerId, setFarmerId] = useState(usuario.papel === 'farmer' ? usuario.id : farmers[0]?.id ?? '')
  const [filtro, setFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'plano' | 'fechamento'>('plano')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carrega = useCallback(async (id: string) => {
    setCarregando(true)
    setErro('')
    const resp = await fetch(`/api/diario/dia?farmerId=${id}`, { cache: 'no-store' })
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({ error: 'falha ao carregar' }))
      setErro(d.error ?? 'falha ao carregar')
      setCarregando(false)
      return
    }
    const novos: Dados = await resp.json()
    setDados(novos)
    // Depois do plano confirmado, o dia acontece na aba de fechamento.
    if (novos.briefing.status !== 'rascunho') setAba('fechamento')
    setCarregando(false)
  }, [])

  useEffect(() => { if (farmerId) carrega(farmerId) }, [farmerId, carrega])

  // Líder e gerência editam o plano de quem está no time deles; o farmer perde
  // a edição quando o líder já revisou o dia.
  const somenteLeitura = usuario.papel === 'farmer' && dados?.briefing.status === 'revisado'

  const itens = useMemo(() => {
    const ordem = (b: string) => ORDEM_BUCKET[b as keyof typeof ORDEM_BUCKET] ?? 9
    return [...(dados?.itens ?? [])].sort((a, b) => ordem(a.bucket) - ordem(b.bucket) || a.companyName.localeCompare(b.companyName))
  }, [dados])

  // Todas as empresas do dia contam, extras inclusive: o dia começa quando as 23 estão mapeadas.
  const doDia = itens
  const semAbordagem = useMemo(() => doDia.filter((i) => !i.abordagem).length, [doDia])
  const comResultado = useMemo(() => doDia.filter((i) => i.resultado).length, [doDia])
  const pendenciasFechamento = useMemo(
    () => doDia.filter((i) => !i.resultado ||
      (RESULTADO_EXIGE_OBSERVACAO.includes(i.resultado as Resultado) &&
        (i.observacaoResultado?.trim().length ?? 0) < MINIMO_OBSERVACAO)).length,
    [doDia],
  )

  // Quantas vieram prontas do CRM, para o farmer saber que não foi ele que marcou.
  const vindasDoHubSpot = useMemo(
    () => doDia.filter((i) => i.atividade?.resultadoSugerido && i.resultado === i.atividade.resultadoSugerido).length,
    [doDia],
  )
  const efetivos = useMemo(() => doDia.filter((i) => i.resultado === 'efetivo').length, [doDia])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => {
      if (filtro !== 'todos' && i.bucket !== filtro) return false
      if (termo && !i.companyName.toLowerCase().includes(termo)) return false
      return true
    })
  }, [itens, filtro, busca])

  function patchLocal(companyId: string, patch: Partial<ItemComHistorico>) {
    setDados((d) => d && ({ ...d, itens: d.itens.map((i) => (i.companyId === companyId ? { ...i, ...patch } : i)) }))
  }

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const patchesPendentes = useRef<Record<string, Partial<ItemComHistorico>>>({})

  /**
   * Salva com debounce por empresa, acumulando os campos: escolher o resultado e
   * logo em seguida escrever a observação não pode cancelar o salvamento anterior.
   */
  function salva(companyId: string, patch: Partial<ItemComHistorico>, atraso = 0) {
    if (!dados) return
    patchLocal(companyId, patch)
    patchesPendentes.current[companyId] = { ...patchesPendentes.current[companyId], ...patch }
    clearTimeout(timers.current[companyId])
    timers.current[companyId] = setTimeout(async () => {
      const corpo = patchesPendentes.current[companyId]
      delete patchesPendentes.current[companyId]
      try {
        const resp = await fetch('/api/diario/item', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dados.data, farmerId: dados.farmerId, companyId, ...corpo }),
        })
        if (!resp.ok) {
          const d = await resp.json().catch(() => ({}))
          setErro(d.error ?? 'não consegui salvar essa alteração')
        }
      } catch {
        setErro('não consegui salvar — verifique a conexão')
      }
    }, atraso)
  }

  async function acao(tipo: 'planejar' | 'fechar') {
    if (!dados) return
    setEnviando(true)
    setAviso('')
    const resp = await fetch('/api/diario/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: tipo, data: dados.data }),
    })
    setEnviando(false)
    const r = await resp.json().catch(() => ({}))
    if (!resp.ok) { setAviso(r.error ?? 'não foi possível concluir'); return }
    if (tipo === 'planejar') setAba('fechamento')
    carrega(farmerId)
  }

  const status = ROTULO_STATUS[dados?.briefing.status ?? 'rascunho']

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <Cabecalho
        titulo="Diário de bordo"
        subtitulo="Carteira do farmer · sincronizado com o HubSpot"
        usuario={usuario}
        ativa="diario"
      />

      {usuario.papel === 'lider' && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs font-bold uppercase tracking-wide bg-zinc-900 text-white px-3 py-1.5 rounded-full">Líder</span>
          <span className="text-sm text-zinc-500">editando o diário de</span>
          <select
            value={farmerId}
            onChange={(e) => setFarmerId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
          >
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      )}

      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{erro}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Cartao titulo="Oportunidades no mês" valor={dados ? String(dados.resumo.oportunidadesCriadas) : '—'} rodape="negócios criados na carteira" />
        <Cartao titulo="Tickets ativos" valor={dados ? String(dados.resumo.ticketsAtivos) : '—'} rodape="eventos em execução no CS" />
        <Cartao titulo="Receita gerada" valor={dados ? moeda(dados.resumo.receitaGerada) : '—'} rodape="negócios ganhos no mês" cor="#FF5200" />
        <Cartao
          titulo="Contato efetivo"
          valor={dados ? `${dados.resumo.pctContatoEfetivo}%` : '—'}
          rodape={dados ? `${dados.resumo.empresasComContatoEfetivo} de ${dados.resumo.carteira} empresas` : 'da carteira no mês'}
        />
      </div>

      {dados?.pool && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Pool da carteira</span>
          <PoolItem rotulo="Recompra" valor={dados.pool.recompra} cota={COTA_DIARIA.recompra} />
          <PoolItem rotulo="Nutrição" valor={dados.pool.nutricao} cota={COTA_DIARIA.nutricao} />
          <PoolItem rotulo="Reativação" valor={dados.pool.reativacao} cota={COTA_DIARIA.reativacao} />
          <PoolItem rotulo="Entre eventos" valor={dados.pool.extra} />
          <PoolItem rotulo="Sem histórico" valor={dados.pool.semHistorico} />
          <span className="text-zinc-500">{dados.pool.negociosAbertos} negócios abertos no funil</span>
          <span className="text-zinc-500">{dados.pool.emDescanso} em descanso</span>
          {dados.pool.precisandoAuxilio > 0 && (
            <span className="text-orange-600 font-medium">{dados.pool.precisandoAuxilio} pedindo auxílio do líder</span>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded ${status.cor}`}>{status.texto}</span>
            <span className="text-sm font-semibold capitalize">{dados ? dataLonga(dados.data) : ''}</span>
            <span className="text-sm text-zinc-500">
              <b className="text-zinc-900">{doDia.length}</b> empresas para abordar
            </span>
            <span className="text-sm text-zinc-500">
              <b className="text-zinc-900">{comResultado}</b>/{doDia.length} com resultado
              {efetivos > 0 && <span className="text-emerald-700"> · {efetivos} efetivo(s)</span>}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-zinc-100 p-1">
              {([['plano', 'Plano do dia'], ['fechamento', 'Fechamento']] as const).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  onClick={() => setAba(chave)}
                  className={`px-4 py-1.5 text-sm rounded-full transition ${aba === chave ? 'bg-white shadow-sm font-medium' : 'text-zinc-500'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {usuario.papel === 'farmer' && aba === 'plano' && (
              <button
                onClick={() => acao('planejar')}
                disabled={enviando || somenteLeitura || semAbordagem > 0}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:bg-zinc-300 disabled:cursor-not-allowed transition"
                style={semAbordagem === 0 && !somenteLeitura ? { background: '#FF5200' } : undefined}
              >
                {enviando ? 'Salvando...' : semAbordagem > 0 ? `Faltam ${semAbordagem} de ${doDia.length}` : 'Iniciar o dia'}
              </button>
            )}
            {usuario.papel === 'farmer' && aba === 'fechamento' && (
              <button
                onClick={() => acao('fechar')}
                disabled={enviando || somenteLeitura || pendenciasFechamento > 0}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:bg-zinc-300 disabled:cursor-not-allowed transition"
                style={pendenciasFechamento === 0 && !somenteLeitura ? { background: '#FF5200' } : undefined}
              >
                {enviando ? 'Fechando...' : pendenciasFechamento > 0 ? `Faltam ${pendenciasFechamento}` : 'Fechar o dia'}
              </button>
            )}
          </div>
        </div>

        {aba === 'fechamento' && vindasDoHubSpot > 0 && (
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 text-sm text-emerald-900">
            <b>{vindasDoHubSpot}</b> {vindasDoHubSpot === 1 ? 'empresa foi preenchida' : 'empresas foram preenchidas'}{' '}
            automaticamente pela sua atividade no HubSpot de hoje. Corrija o que estiver errado e complete o resto.
          </div>
        )}
        {aviso && <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">{aviso}</div>}
        {dados?.briefing.comentarioLider && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 text-sm text-blue-900">
            <b>{dados.briefing.decididoPor}:</b> {dados.briefing.comentarioLider}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-zinc-100">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa..."
            className="flex-1 min-w-[220px] rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex flex-wrap gap-2">
            {['todos', 'recompra', 'nutricao', 'reativacao', 'extra', 'primeiro_contato'].map((b) => {
              const total = b === 'todos' ? itens.length : itens.filter((i) => i.bucket === b).length
              if (total === 0 && b !== 'todos') return null
              return (
                <button
                  key={b}
                  onClick={() => setFiltro(b)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                    filtro === b ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {b === 'todos' ? 'Todas' : BUCKETS[b as keyof typeof BUCKETS].label} · {total}
                </button>
              )
            })}
          </div>
        </div>

        {carregando ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Montando a lista do dia...</p>
        ) : visiveis.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Nenhuma empresa nesse filtro.</p>
        ) : aba === 'plano' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                <th className="text-left font-semibold px-5 py-3">Empresa</th>
                <th className="text-left font-semibold px-3 py-3 w-[170px]">Fase</th>
                <th className="text-left font-semibold px-3 py-3 w-[130px]">Últ. contato efetivo</th>
                <th className="text-left font-semibold px-3 py-3 w-[270px]">Abordagem</th>
                <th className="text-left font-semibold px-3 py-3 w-[300px]">Contexto (opcional)</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => (
                <tr key={i.companyId} className="border-b border-zinc-50 align-top">
                  <td className="px-5 py-4"><Empresa item={i} /></td>
                  <td className="px-3 py-4"><Fase item={i} /></td>
                  <td className="px-3 py-4 text-zinc-600" title="Campo Último Contato Efetivo, no HubSpot">
                    {dataCurta(i.ultimoContato)}
                  </td>
                  <td className="px-3 py-4">
                    <select
                      value={i.abordagem ?? ''}
                      disabled={somenteLeitura}
                      onChange={(e) => salva(i.companyId, { abordagem: e.target.value })}
                      className={`w-full rounded-lg border px-2.5 py-2 text-sm bg-white disabled:bg-zinc-50 ${
                        i.abordagem ? 'border-zinc-200' : 'border-orange-400'
                      }`}
                    >
                      <option value="">Escolher abordagem...</option>
                      {ABORDAGENS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {!i.abordagem && !somenteLeitura && (
                      <button
                        onClick={() => salva(i.companyId, { abordagem: ABORDAGEM_PADRAO[i.bucket as Bucket] })}
                        className="mt-1.5 text-[11px] text-zinc-500 hover:text-orange-600 underline underline-offset-2 text-left"
                      >
                        sugerida: {ABORDAGEM_PADRAO[i.bucket as Bucket]}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <textarea
                      value={i.observacao ?? ''}
                      disabled={somenteLeitura}
                      rows={2}
                      placeholder="O que você vai levar?"
                      onChange={(e) => salva(i.companyId, { observacao: e.target.value }, 600)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-sm resize-y disabled:bg-zinc-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                <th className="text-left font-semibold px-5 py-3">Empresa</th>
                <th className="text-left font-semibold px-3 py-3 w-[170px]">Fase</th>
                <th className="text-left font-semibold px-3 py-3 w-[230px]">Abordagem planejada</th>
                <th className="text-left font-semibold px-3 py-3 w-[330px]">Resultado</th>
                <th className="text-left font-semibold px-3 py-3 w-[300px]">Observação do resultado · mín. {MINIMO_OBSERVACAO}</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => {
                const escrito = i.observacaoResultado?.trim().length ?? 0
                const exigeObs = RESULTADO_EXIGE_OBSERVACAO.includes(i.resultado as Resultado)
                const faltaObs = exigeObs && escrito < MINIMO_OBSERVACAO
                return (
                  <tr key={i.companyId} className={`border-b border-zinc-50 align-top ${i.resultado === 'efetivo' ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-5 py-4"><Empresa item={i} /></td>
                    <td className="px-3 py-4"><Fase item={i} /></td>
                    <td className="px-3 py-4">
                      {i.abordagem
                        ? <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-1 rounded">{i.abordagem}</span>
                        : <span className="text-xs text-zinc-400">sem abordagem definida</span>}
                    </td>
                    <td className="px-3 py-4">
                      {i.atividade && (
                        <p className="text-[11px] text-zinc-500 mb-1.5">
                          {i.resultado === i.atividade.resultadoSugerido ? 'preenchido pelo HubSpot: ' : 'no HubSpot hoje: '}
                          {[
                            i.atividade.ligacoes > 0 && `${i.atividade.ligacoes} ligação(ões)`,
                            i.atividade.conectadas > 0 && `${i.atividade.conectadas} conectada(s)`,
                            i.atividade.reunioes > 0 && `${i.atividade.reunioes} reunião(ões)`,
                            i.atividade.outras > 0 && `${i.atividade.outras} e-mail/nota`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {RESULTADOS.map((r) => {
                          const ativo = i.resultado === r.key
                          return (
                            <button
                              key={r.key}
                              disabled={somenteLeitura}
                              onClick={() => salva(i.companyId, { resultado: ativo ? null : r.key })}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition disabled:opacity-60 ${
                                ativo ? CORES_RESULTADO[r.key].ativo : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                              }`}
                            >
                              {r.label}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <textarea
                        value={i.observacaoResultado ?? ''}
                        disabled={somenteLeitura}
                        rows={2}
                        placeholder={exigeObs ? 'O que saiu daí? (obrigatório)' : 'Observação (o HubSpot já tem a evidência)'}
                        onChange={(e) => salva(i.companyId, { observacaoResultado: e.target.value }, 600)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-sm resize-y disabled:bg-zinc-50 ${
                          faltaObs ? 'border-orange-400' : 'border-zinc-200'
                        }`}
                      />
                      {exigeObs && (
                        <p className={`text-[10px] mt-1 ${faltaObs ? 'text-orange-600' : 'text-zinc-400'}`}>
                          {escrito}/{MINIMO_OBSERVACAO} caracteres
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Empresa({ item }: { item: ItemComHistorico }) {
  return (
    <>
      <a href={`https://app.hubspot.com/contacts/49656171/record/0-2/${item.companyId}`} target="_blank" rel="noreferrer"
        className="font-medium hover:text-orange-600 hover:underline">
        {item.companyName}
      </a>
      <div className="text-xs text-zinc-400 mt-0.5">
        {item.ultimaCompra ? `última compra ${dataCurta(item.ultimaCompra)}` : 'nunca contratou'}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <Retorno historico={item.historico} />
        {item.precisaAuxilio && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white tracking-wide">
            AUXÍLIO DO LÍDER
          </span>
        )}
        {item.seloRelacionamento && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-600 text-white tracking-wide"
            title="Negócio registrado e mais de uma reunião de relacionamento realizada por você nesta empresa"
          >
            RELACIONAMENTO
          </span>
        )}
        {item.editadoPor && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
            editado por {item.editadoPor}
          </span>
        )}
      </div>
      {item.orientacao && (
        <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2 max-w-xs">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{item.orientacao.autor}</p>
          <p className="text-xs text-blue-900 mt-0.5">{item.orientacao.texto}</p>
        </div>
      )}
    </>
  )
}

/** Por que esta empresa está de volta na lista. */
function Retorno({ historico }: { historico: HistoricoItem | null }) {
  if (!historico) return null
  const quando = dataCurta(historico.ultimaData)
  let texto: string
  let cor = 'text-zinc-500 bg-zinc-100'
  if (historico.ultimoResultado === 'nao_abordei') {
    texto = `não abordada em ${quando}`
    cor = 'text-orange-700 bg-orange-50'
  } else if (historico.ultimoResultado === 'tentativa') {
    texto = `${historico.tentativasSeguidas + 1}ª tentativa · sem contato desde ${quando}`
    cor = 'text-amber-700 bg-amber-50'
  } else if (historico.ultimoResultado === 'efetivo') {
    texto = `falaram em ${quando}`
    cor = 'text-emerald-700 bg-emerald-50'
  } else {
    texto = `apareceu em ${quando}`
  }
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cor}`}>{texto}</span>
}

function Fase({ item }: { item: ItemComHistorico }) {
  return (
    <>
      <span className={`text-[11px] font-semibold px-2 py-1 rounded border ${CORES_BUCKET[item.bucket] ?? CORES_BUCKET.primeiro_contato}`}>
        {BUCKETS[item.bucket as keyof typeof BUCKETS]?.label ?? item.bucket}
      </span>
      <div className="text-xs text-zinc-500 mt-1.5">{meses(item.diasDesdeCompra)}</div>
    </>
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

function PoolItem({ rotulo, valor, cota }: { rotulo: string; valor: number; cota?: number }) {
  const magro = cota !== undefined && valor < cota
  return (
    <span className="text-zinc-500">
      {rotulo}: <b className={magro ? 'text-orange-600' : 'text-zinc-900'}>{valor}</b>
      {magro && <span className="text-orange-600"> (abaixo da cota)</span>}
    </span>
  )
}
