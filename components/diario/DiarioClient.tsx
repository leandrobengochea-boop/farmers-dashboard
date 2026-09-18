'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ABORDAGENS, BUCKETS, COOLDOWN_DIAS, COTA_DIARIA, ORDEM_BUCKET } from '@/lib/diario/constants'
import type { Briefing, ItemDiario } from '@/lib/diario/db'
import type { PoolCarteira, ResumoMes } from '@/lib/diario/metrics'
import { LogoPSA, dataLonga, iniciais, meses, moeda, dataCurta } from './Marca'

interface Props {
  usuario: { id: string; nome: string; papel: string; timeKey: string | null }
  farmers: Array<{ id: string; nome: string }>
}

interface Dados {
  farmerId: string
  data: string
  itens: ItemDiario[]
  pool: (PoolCarteira & { emDescanso: number }) | null
  resumo: ResumoMes
  briefing: Briefing
}

const CORES_BUCKET: Record<string, string> = {
  recompra: 'bg-orange-100 text-orange-800 border-orange-200',
  reativacao: 'bg-blue-100 text-blue-800 border-blue-200',
  extra: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  primeiro_contato: 'bg-zinc-100 text-zinc-700 border-zinc-200',
}

const ROTULO_STATUS: Record<string, { texto: string; cor: string }> = {
  rascunho: { texto: 'NÃO ENVIADO', cor: 'bg-zinc-200 text-zinc-700' },
  enviado: { texto: 'AGUARDANDO LÍDER', cor: 'bg-blue-600 text-white' },
  aprovado: { texto: 'APROVADO', cor: 'bg-emerald-600 text-white' },
  ajustar: { texto: 'AJUSTAR', cor: 'bg-amber-500 text-white' },
}

export default function DiarioClient({ usuario, farmers }: Props) {
  const router = useRouter()
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [farmerId, setFarmerId] = useState(usuario.papel === 'farmer' ? usuario.id : farmers[0]?.id ?? '')
  const [filtro, setFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'tabela' | 'meudia'>('tabela')
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
    setDados(await resp.json())
    setCarregando(false)
  }, [])

  useEffect(() => { if (farmerId) carrega(farmerId) }, [farmerId, carrega])

  const somenteLeitura = usuario.papel !== 'farmer' || dados?.briefing.status === 'aprovado'

  const itens = useMemo(() => {
    const ordem = (b: string) => ORDEM_BUCKET[b as keyof typeof ORDEM_BUCKET] ?? 9
    return [...(dados?.itens ?? [])].sort((a, b) => ordem(a.bucket) - ordem(b.bucket) || a.companyName.localeCompare(b.companyName))
  }, [dados])
  const marcados = useMemo(() => itens.filter((i) => i.marcado), [itens])
  const pendentes = useMemo(
    () => marcados.filter((i) => !i.abordagem || !i.observacao?.trim()).length,
    [marcados],
  )

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((i) => {
      if (filtro !== 'todos' && i.bucket !== filtro) return false
      if (termo && !i.companyName.toLowerCase().includes(termo)) return false
      return true
    })
  }, [itens, filtro, busca])

  function patchLocal(companyId: string, patch: Partial<ItemDiario>) {
    setDados((d) => d && ({ ...d, itens: d.itens.map((i) => (i.companyId === companyId ? { ...i, ...patch } : i)) }))
  }

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const patchesPendentes = useRef<Record<string, Partial<ItemDiario>>>({})

  /**
   * Salva com debounce por empresa, acumulando os campos: marcar a empresa e
   * logo em seguida escolher a abordagem não pode cancelar o salvamento da marcação.
   */
  function salva(companyId: string, patch: Partial<ItemDiario>, atraso = 0) {
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
          body: JSON.stringify({ data: dados.data, companyId, ...corpo }),
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

  async function enviaBriefing() {
    if (!dados) return
    setEnviando(true)
    setAviso('')
    const resp = await fetch('/api/diario/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'enviar', data: dados.data }),
    })
    setEnviando(false)
    const r = await resp.json().catch(() => ({}))
    if (!resp.ok) { setAviso(r.error ?? 'não foi possível enviar'); return }
    carrega(farmerId)
  }

  async function sair() {
    await fetch('/api/diario/logout', { method: 'POST' })
    router.push('/diario/login')
    router.refresh()
  }

  const status = ROTULO_STATUS[dados?.briefing.status ?? 'rascunho']

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      {/* Cabeçalho */}
      <header className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <LogoPSA />
          <div>
            <h1 className="font-black tracking-tight text-2xl uppercase leading-none">Diário de bordo</h1>
            <p className="text-sm text-zinc-500 mt-1">Carteira do farmer · sincronizado com o HubSpot</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full pl-1.5 pr-4 py-1.5">
            <span className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold grid place-items-center">
              {iniciais(usuario.nome)}
            </span>
            <span className="text-sm font-medium">{usuario.nome}</span>
          </div>
          <button onClick={sair} className="text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-2">Sair</button>
        </div>
      </header>

      {usuario.papel === 'lider' && (
        <div className="flex items-center gap-3 mb-6">
          <a href="/diario/agenda" className="text-sm px-4 py-2 rounded-full bg-white border border-zinc-200 hover:border-zinc-400">
            Agenda do dia
          </a>
          <span className="text-xs font-bold uppercase tracking-wide bg-zinc-900 text-white px-3 py-1.5 rounded-full">Líder</span>
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

      {/* Resumo do mês */}
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

      {/* Saúde do pool de sugestões */}
      {dados?.pool && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">Pool da carteira</span>
          <PoolItem rotulo="Recompra" valor={dados.pool.recompra} cota={COTA_DIARIA.recompra} />
          <PoolItem rotulo="Reativação" valor={dados.pool.reativacao} cota={COTA_DIARIA.reativacao} />
          <PoolItem rotulo="Entre eventos" valor={dados.pool.extra} />
          <PoolItem rotulo="Sem histórico" valor={dados.pool.semHistorico} />
          <span className="text-zinc-500">{dados.pool.negociosAbertos} negócios abertos no funil</span>
          <span className="text-zinc-500">{dados.pool.emDescanso} em descanso ({COOLDOWN_DIAS}d)</span>
        </div>
      )}

      {/* Barra do dia */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded ${status.cor}`}>{status.texto}</span>
            <span className="text-sm font-semibold capitalize">{dados ? dataLonga(dados.data) : ''}</span>
            <span className="text-sm text-zinc-500">
              <b className="text-zinc-900">{marcados.length}</b> empresa(s) para hoje
            </span>
            {pendentes > 0 && (
              <span className="text-sm text-orange-600 font-medium">{pendentes} sem abordagem ou observação</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-zinc-100 p-1">
              {(['tabela', 'meudia'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  className={`px-4 py-1.5 text-sm rounded-full transition ${aba === a ? 'bg-white shadow-sm font-medium' : 'text-zinc-500'}`}
                >
                  {a === 'tabela' ? 'Sugestões' : 'Meu dia'}
                </button>
              ))}
            </div>
            {usuario.papel === 'farmer' && (
              <button
                onClick={enviaBriefing}
                disabled={enviando || somenteLeitura || marcados.length === 0 || pendentes > 0}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:bg-zinc-300 disabled:cursor-not-allowed transition"
                style={marcados.length > 0 && pendentes === 0 && !somenteLeitura ? { background: '#FF5200' } : undefined}
              >
                {enviando ? 'Enviando...' : 'Enviar briefing para aprovação'}
              </button>
            )}
          </div>
        </div>

        {aviso && <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">{aviso}</div>}
        {dados?.briefing.comentarioLider && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 text-sm text-blue-900">
            <b>{dados.briefing.decididoPor}:</b> {dados.briefing.comentarioLider}
          </div>
        )}

        {aba === 'tabela' ? (
          <>
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-zinc-100">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar empresa..."
                className="flex-1 min-w-[220px] rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                {['todos', 'recompra', 'reativacao', 'extra', 'primeiro_contato'].map((b) => {
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
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                    <th className="text-left font-semibold px-5 py-3 w-[110px]">Atuar hoje</th>
                    <th className="text-left font-semibold px-3 py-3">Empresa</th>
                    <th className="text-left font-semibold px-3 py-3 w-[170px]">Fase</th>
                    <th className="text-left font-semibold px-3 py-3 w-[120px]">Últ. contato</th>
                    <th className="text-left font-semibold px-3 py-3 w-[260px]">Abordagem</th>
                    <th className="text-left font-semibold px-3 py-3 w-[280px]">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((i) => (
                    <tr key={i.companyId} className={`border-b border-zinc-50 align-top ${i.marcado ? 'bg-orange-50/40' : ''}`}>
                      <td className="px-5 py-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={i.marcado}
                            disabled={somenteLeitura}
                            onChange={(e) => salva(i.companyId, { marcado: e.target.checked })}
                            className="w-4 h-4 accent-orange-600"
                          />
                          <span className={i.marcado ? 'font-semibold' : 'text-zinc-500'}>Atuar</span>
                        </label>
                      </td>
                      <td className="px-3 py-4">
                        <a href={`https://app.hubspot.com/contacts/49656171/record/0-2/${i.companyId}`} target="_blank" rel="noreferrer"
                          className="font-medium hover:text-orange-600 hover:underline">
                          {i.companyName}
                        </a>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {i.ultimaCompra ? `última compra ${dataCurta(i.ultimaCompra)}` : 'nunca contratou'}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded border ${CORES_BUCKET[i.bucket] ?? CORES_BUCKET.primeiro_contato}`}>
                          {BUCKETS[i.bucket as keyof typeof BUCKETS]?.label ?? i.bucket}
                        </span>
                        <div className="text-xs text-zinc-500 mt-1.5">{meses(i.diasDesdeCompra)}</div>
                      </td>
                      <td className="px-3 py-4 text-zinc-600">{dataCurta(i.ultimoContato)}</td>
                      <td className="px-3 py-4">
                        <select
                          value={i.abordagem ?? ''}
                          disabled={somenteLeitura}
                          onChange={(e) => salva(i.companyId, { abordagem: e.target.value })}
                          className={`w-full rounded-lg border px-2.5 py-2 text-sm bg-white disabled:bg-zinc-50 ${
                            i.marcado && !i.abordagem ? 'border-orange-400' : 'border-zinc-200'
                          }`}
                        >
                          <option value="">Escolher abordagem...</option>
                          {ABORDAGENS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-4">
                        <textarea
                          value={i.observacao ?? ''}
                          disabled={somenteLeitura}
                          rows={2}
                          placeholder={i.marcado ? 'Obrigatório: o que você vai levar?' : 'Observação'}
                          onChange={(e) => salva(i.companyId, { observacao: e.target.value }, 600)}
                          className={`w-full rounded-lg border px-2.5 py-2 text-sm resize-y disabled:bg-zinc-50 ${
                            i.marcado && !i.observacao?.trim() ? 'border-orange-400' : 'border-zinc-200'
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="p-5 grid gap-3">
            {marcados.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">Nenhuma empresa marcada ainda. Volte em “Sugestões” e escolha quem você vai atacar hoje.</p>
            ) : marcados.map((i) => (
              <div key={i.companyId} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{i.companyName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {BUCKETS[i.bucket as keyof typeof BUCKETS]?.label} · {meses(i.diasDesdeCompra)} desde a última compra
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded border shrink-0 ${CORES_BUCKET[i.bucket] ?? CORES_BUCKET.primeiro_contato}`}>
                    {i.abordagem ?? 'sem abordagem'}
                  </span>
                </div>
                {i.observacao && <p className="text-sm text-zinc-700 mt-3 border-l-2 border-orange-300 pl-3">{i.observacao}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
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

function PoolItem({ rotulo, valor, cota }: { rotulo: string; valor: number; cota?: number }) {
  const magro = cota !== undefined && valor < cota
  return (
    <span className="text-zinc-500">
      {rotulo}: <b className={magro ? 'text-orange-600' : 'text-zinc-900'}>{valor}</b>
      {magro && <span className="text-orange-600"> (abaixo da cota de {cota})</span>}
    </span>
  )
}
