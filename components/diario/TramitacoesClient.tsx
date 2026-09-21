'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RESULTADOS_TRAMITACAO, RESULTADO_TRAMITACAO_EXIGE_OBSERVACAO, ResultadoTramitacao,
  TRAMITACOES, TipoTramitacao,
} from '@/lib/diario/constants'
import Cabecalho from './Cabecalho'
import { dataLonga, dataCurta, iniciais } from './Marca'

interface Props {
  usuario: { id: string; nome: string; papel: string; timeKey: string | null }
  farmers: Array<{ id: string; nome: string }>
}

interface Pendencia {
  ticketId: string
  tipo: TipoTramitacao
  assunto: string
  etapa: string
  prazo: string
  diasParaPrazo: number
  dataOnboarding: string | null
  dataEvento: string | null
  statusContrato: string | null
  eventoPassado: boolean
  hubspotUrl: string
  feitoEm: string | null
  confirmadoEm: string | null
  confirmadoPor: string | null
  selecionado: boolean
  resultado: string | null
  observacao: string | null
}

interface Aguardando {
  farmerId: string
  nome: string
  ticketId: string
  tipo: string
  assunto: string
  feitoEm: string | null
  rotulo: string
}

interface Dados {
  farmerId: string
  data: string
  pendencias: Pendencia[]
  aguardando: Aguardando[]
}

const CORES_TIPO: Record<TipoTramitacao, string> = {
  minuta: 'bg-orange-100 text-orange-800 border-orange-200',
  assinatura: 'bg-violet-100 text-violet-800 border-violet-200',
  checklist: 'bg-blue-100 text-blue-800 border-blue-200',
}

const CORES_RESULTADO: Record<ResultadoTramitacao, string> = {
  resolvi: 'bg-emerald-600 text-white border-emerald-600',
  avancei: 'bg-blue-600 text-white border-blue-600',
  travado: 'bg-amber-500 text-white border-amber-500',
}

export default function TramitacoesClient({ usuario, farmers }: Props) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [farmerId, setFarmerId] = useState(usuario.papel === 'farmer' ? usuario.id : farmers[0]?.id ?? '')

  const carrega = useCallback(async (id: string) => {
    setCarregando(true)
    setErro('')
    const resp = await fetch(`/api/diario/tramitacoes?farmerId=${id}`, { cache: 'no-store' })
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

  // Líder e gerência ajustam seleção e resultado; marcar como feito segue sendo do farmer.
  const somenteLeitura = false
  const pendencias = dados?.pendencias ?? []

  const grupos = useMemo(() => {
    const ativas = pendencias.filter((p) => !p.eventoPassado)
    return {
      vencidas: ativas.filter((p) => p.diasParaPrazo < 0),
      hoje: ativas.filter((p) => p.diasParaPrazo === 0),
      noPrazo: ativas.filter((p) => p.diasParaPrazo > 0),
      passados: pendencias.filter((p) => p.eventoPassado),
    }
  }, [pendencias])

  const selecionadas = pendencias.filter((p) => p.selecionado)
  const aguardandoLider = pendencias.filter((p) => p.feitoEm && !p.confirmadoEm).length

  function patchLocal(chave: string, patch: Partial<Pendencia>) {
    setDados((d) => d && ({
      ...d,
      pendencias: d.pendencias.map((p) => (`${p.ticketId}:${p.tipo}` === chave ? { ...p, ...patch } : p)),
    }))
  }

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendentes = useRef<Record<string, Partial<Pendencia>>>({})

  function salva(p: Pendencia, patch: Partial<Pendencia>, atraso = 0) {
    if (!dados) return
    const chave = `${p.ticketId}:${p.tipo}`
    patchLocal(chave, patch)
    pendentes.current[chave] = { ...pendentes.current[chave], ...patch }
    clearTimeout(timers.current[chave])
    timers.current[chave] = setTimeout(async () => {
      const corpo = pendentes.current[chave]
      delete pendentes.current[chave]
      const resp = await fetch('/api/diario/tramitacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dados.data, farmerId: dados.farmerId, ticketId: p.ticketId, tipo: p.tipo,
          assunto: p.assunto, ...corpo,
        }),
      }).catch(() => null)
      if (!resp?.ok) setErro('não consegui salvar essa alteração')
    }, atraso)
  }

  async function marcaFeito(p: Pendencia, feito: boolean) {
    await fetch('/api/diario/tramitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: feito ? 'feito' : 'desfazer', ticketId: p.ticketId, tipo: p.tipo, assunto: p.assunto }),
    })
    carrega(farmerId)
  }

  async function confirma(a: Aguardando) {
    await fetch('/api/diario/tramitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'confirmar', farmerId: a.farmerId, ticketId: a.ticketId, tipo: a.tipo }),
    })
    carrega(farmerId)
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <Cabecalho
        titulo="Tramitações"
        subtitulo={dados ? `${dataLonga(dados.data)} · os tickets que pedem ação hoje` : 'carregando...'}
        usuario={usuario}
        ativa="tramitacoes"
      />

      {usuario.papel === 'lider' && (
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-bold uppercase tracking-wide bg-zinc-900 text-white px-3 py-1.5 rounded-full">Líder</span>
          <span className="text-sm text-zinc-500">editando as tramitações de</span>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Cartao titulo="Vencidas" valor={grupos.vencidas.length} cor="#FF5200" rodape="prazo já estourou" />
        <Cartao titulo="Vencem hoje" valor={grupos.hoje.length} rodape="último dia" />
        <Cartao titulo="Escolhidas para hoje" valor={selecionadas.length} rodape="você marcou para tratar" />
        <Cartao titulo="Aguardando líder" valor={aguardandoLider} rodape="marcadas, esperando confirmação" />
      </div>

      {/* Painel do líder: dupla checagem */}
      {usuario.papel === 'lider' && (dados?.aguardando.length ?? 0) > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800 mb-1">Aguardando sua confirmação</h2>
          <p className="text-xs text-emerald-700/80 mb-4">
            O farmer marcou como feito. Confirme para a pendência sair do board dele.
          </p>
          <div className="grid gap-2">
            {dados!.aguardando.map((a) => (
              <div key={`${a.farmerId}:${a.ticketId}:${a.tipo}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-emerald-200 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-bold grid place-items-center shrink-0">
                    {iniciais(a.nome)}
                  </span>
                  <span className="text-xs text-zinc-500 shrink-0">{a.nome}</span>
                  <span className="text-sm font-medium truncate">{a.assunto}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-zinc-50 border-zinc-200 shrink-0">{a.rotulo}</span>
                </div>
                <button
                  onClick={() => confirma(a)}
                  className="text-xs font-semibold px-4 py-2 rounded-lg text-white shrink-0"
                  style={{ background: '#059669' }}
                >
                  Confirmar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Buscando os tickets no HubSpot...</p>
      ) : pendencias.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Nenhuma tramitação pendente hoje. Bom sinal.</p>
      ) : (
        <>
          <Grupo titulo="Vencidas" itens={grupos.vencidas} cor="text-orange-700" somenteLeitura={somenteLeitura} souFarmer={usuario.papel === 'farmer'} onSalva={salva} onMarcaFeito={marcaFeito} />
          <Grupo titulo="Vencem hoje" itens={grupos.hoje} cor="text-zinc-900" somenteLeitura={somenteLeitura} souFarmer={usuario.papel === 'farmer'} onSalva={salva} onMarcaFeito={marcaFeito} />
          <Grupo titulo="No prazo" itens={grupos.noPrazo} cor="text-zinc-500" somenteLeitura={somenteLeitura} souFarmer={usuario.papel === 'farmer'} onSalva={salva} onMarcaFeito={marcaFeito} />
          {grupos.passados.length > 0 && (
            <Grupo
              titulo="Eventos que já aconteceram"
              subtitulo="O ticket segue aberto no pipeline — vale conferir se ainda falta algo."
              itens={grupos.passados}
              cor="text-zinc-400" somenteLeitura={somenteLeitura} souFarmer={usuario.papel === 'farmer'} onSalva={salva} onMarcaFeito={marcaFeito}
            />
          )}
        </>
      )}
    </div>
  )

}


interface PropsCard {
somenteLeitura: boolean
souFarmer: boolean
onSalva: (p: Pendencia, patch: Partial<Pendencia>, atraso?: number) => void
onMarcaFeito: (p: Pendencia, feito: boolean) => void
}

function Grupo({ titulo, subtitulo, itens, cor, ...acoes }: { titulo: string; subtitulo?: string; itens: Pendencia[]; cor: string } & PropsCard) {
  if (itens.length === 0) return null
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${cor}`}>{titulo}</h2>
        <span className="text-xs text-zinc-400">{itens.length}</span>
      </div>
      {subtitulo && <p className="text-xs text-zinc-500 mb-3 -mt-2">{subtitulo}</p>}
      <div className="grid gap-3">
        {itens.map((p) => <Card key={`${p.ticketId}:${p.tipo}`} p={p} {...acoes} />)}
      </div>
    </section>
  )
}

function Card({ p, somenteLeitura, souFarmer, onSalva, onMarcaFeito }: { p: Pendencia } & PropsCard) {
  const tipo = TRAMITACOES[p.tipo]
  const exigeObs = RESULTADO_TRAMITACAO_EXIGE_OBSERVACAO.includes(p.resultado as ResultadoTramitacao)
  const faltaObs = exigeObs && !p.observacao?.trim()
  const atrasada = p.diasParaPrazo < 0 && !p.eventoPassado

  return (
    <div className={`rounded-2xl border bg-white px-5 py-4 ${p.selecionado ? 'border-orange-300 bg-orange-50/30' : 'border-zinc-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-1 rounded border ${CORES_TIPO[p.tipo]}`}>{tipo.label}</span>
            {atrasada && (
              <span className="text-[11px] font-bold px-2 py-1 rounded bg-orange-600 text-white">
                VENCIDA HÁ {Math.abs(p.diasParaPrazo)} {Math.abs(p.diasParaPrazo) === 1 ? 'DIA' : 'DIAS'}
              </span>
            )}
            {p.diasParaPrazo === 0 && !p.eventoPassado && (
              <span className="text-[11px] font-bold px-2 py-1 rounded bg-zinc-900 text-white">VENCE HOJE</span>
            )}
            {p.feitoEm && (
              <span className="text-[11px] font-bold px-2 py-1 rounded bg-emerald-600 text-white">AGUARDANDO LÍDER</span>
            )}
          </div>
          <a href={p.hubspotUrl} target="_blank" rel="noreferrer"
            className="block font-medium mt-2 hover:text-orange-600 hover:underline">
            {p.assunto}
          </a>
          <p className="text-xs text-zinc-500 mt-1">
            {tipo.acao} · prazo {dataCurta(p.prazo)}
            {p.diasParaPrazo > 0 && ` (em ${p.diasParaPrazo} ${p.diasParaPrazo === 1 ? 'dia' : 'dias'})`}
            {p.etapa && ` · ${p.etapa}`}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {p.dataOnboarding && `onboarding ${dataCurta(p.dataOnboarding)}`}
            {p.dataEvento && ` · evento ${dataCurta(p.dataEvento)}`}
            {p.statusContrato && ` · contrato ${p.statusContrato.toLowerCase()}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={p.selecionado}
              disabled={somenteLeitura}
              onChange={(e) => onSalva(p, { selecionado: e.target.checked })}
              className="w-4 h-4 accent-orange-600"
            />
            <span className={`text-sm ${p.selecionado ? 'font-semibold' : 'text-zinc-500'}`}>Tratar hoje</span>
          </label>
          {souFarmer && (
            <button
              onClick={() => onMarcaFeito(p, !p.feitoEm)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition ${
                p.feitoEm ? 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500' : 'border-emerald-600 bg-emerald-600 text-white'
              }`}
            >
              {p.feitoEm ? 'Desfazer' : 'Marcar como feito'}
            </button>
          )}
        </div>
      </div>

      {p.selecionado && (
        <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-start gap-3">
          <div className="flex gap-1.5">
            {RESULTADOS_TRAMITACAO.map((r) => {
              const ativo = p.resultado === r.key
              return (
                <button
                  key={r.key}
                  disabled={somenteLeitura}
                  onClick={() => onSalva(p, { resultado: ativo ? null : r.key })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition disabled:opacity-60 ${
                    ativo ? CORES_RESULTADO[r.key] : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
          <textarea
            value={p.observacao ?? ''}
            disabled={somenteLeitura}
            rows={1}
            placeholder={exigeObs ? 'Obrigatório: o que travou?' : 'Observação (opcional)'}
            onChange={(e) => onSalva(p, { observacao: e.target.value }, 600)}
            className={`flex-1 min-w-[240px] rounded-lg border px-2.5 py-2 text-sm resize-y disabled:bg-zinc-50 ${
              faltaObs ? 'border-orange-400' : 'border-zinc-200'
            }`}
          />
        </div>
      )}
    </div>
  )
}

function Cartao({ titulo, valor, rodape, cor }: { titulo: string; valor: number; rodape: string; cor?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{titulo}</p>
      <p className="text-3xl font-black tracking-tight mt-1.5" style={cor && valor > 0 ? { color: cor } : undefined}>{valor}</p>
      <p className="text-xs text-zinc-400 mt-1">{rodape}</p>
    </div>
  )
}
