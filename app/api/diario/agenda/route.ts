import { NextResponse } from 'next/server'
import { FARMERS, TEAMS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, TRAMITACOES, TipoTramitacao } from '@/lib/diario/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { resumoDoMes } from '@/lib/diario/metrics'
import {
  itensDoDiaDeVarios, briefingsDoDia, historicoDeVarios, orientacoesDe,
  tramitacoesDoDia, statusTramitacoes, chaveTramitacao, trocasPendentes, ItemDiario,
} from '@/lib/diario/db'
import { precisaAuxilio } from '@/lib/diario/carteira'
import { Pendencia, pendenciasDeVarios } from '@/lib/diario/tramitacoes'
import { AtividadeEmpresa, aplicaAtividade, atividadeDeVarios } from '@/lib/diario/atividade'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface AgendaFarmer {
  farmerId: string
  nome: string
  timeLabel: string
  status: string
  primeiroAcesso: string | null
  comentarioLider: string | null
  itens: ItemDiario[]
  auxilios: Array<{
    companyId: string
    companyName: string
    tentativas: number
    ultimaData: string
    naListaDeHoje: boolean
    orientacao: { texto: string; autor: string; criadoEm: string } | null
  }>
  trocas: Array<{ companyId: string; companyName: string; motivo: string; pedidoEm: string }>
  placar: {
    total: number; extras: number; efetivo: number; tentativa: number
    naoAbordei: number; trocaSegmento: number; pendente: number
  }
}

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const data = new URL(req.url).searchParams.get('data') || hojeSP()
  // Líder vê o time; farmer vê a si mesmo.
  const farmerIds = usuario.papel === 'lider' ? farmersDoLider(usuario.timeKey) : [usuario.id]

  try {
    const [itens, briefings, resumo, historico, orientacoes, tramitacoes, pendencias, statusTram, trocas] = await Promise.all([
      itensDoDiaDeVarios(farmerIds, data),
      briefingsDoDia(farmerIds, data),
      resumoDoMes(farmerIds, data),
      historicoDeVarios(farmerIds, data),
      orientacoesDe(farmerIds),
      tramitacoesDoDia(farmerIds, data),
      pendenciasDeVarios(farmerIds, data).catch(() => new Map<string, Pendencia[]>()),
      statusTramitacoes(farmerIds),
      trocasPendentes(farmerIds),
    ])

    // O acompanhamento do dia é automático: a agenda deriva a efetividade da
    // atividade no HubSpot, sem depender de o farmer reabrir o diário.
    const atividade = await atividadeDeVarios(farmerIds, data).catch(() => new Map<string, Map<string, AtividadeEmpresa>>())
    for (const farmerId of farmerIds) {
      const doFarmer = itens.filter((i) => i.farmerId === farmerId)
      const dele = atividade.get(farmerId)
      if (doFarmer.length > 0 && dele?.size) await aplicaAtividade(farmerId, data, doFarmer, dele)
    }

    const timeLabelPorFarmer: Record<string, string> = {}
    for (const time of Object.values(TEAMS)) {
      for (const id of time.farmerIds) timeLabelPorFarmer[id] = time.label
    }

    const agenda: AgendaFarmer[] = farmerIds.map((farmerId) => {
      const doFarmer = itens.filter((i) => i.farmerId === farmerId)
      // Os extras (clientes recentes) são bônus e não entram no placar do dia.
      const doDia = doFarmer.filter((i) => i.bucket !== 'extra')
      const brief = briefings.find((b) => b.farmerId === farmerId)
      // Empresas com três tentativas sem contato: seguem na lista do farmer,
      // esperando uma orientação do líder.
      const orientacoesDoFarmer = orientacoes.get(farmerId)
      const auxilios = [...(historico.get(farmerId)?.values() ?? [])]
        .filter(precisaAuxilio)
        .sort((a, b) => b.ultimaData.localeCompare(a.ultimaData))
        .map((h) => {
          const o = orientacoesDoFarmer?.get(h.companyId) ?? null
          return {
            companyId: h.companyId,
            companyName: h.companyName,
            tentativas: h.tentativasSeguidas,
            ultimaData: h.ultimaData,
            naListaDeHoje: doFarmer.some((i) => i.companyId === h.companyId),
            orientacao: o ? { texto: o.texto, autor: o.autor, criadoEm: o.criadoEm } : null,
          }
        })
      // Estado das tramitações mesmo quando o farmer não escolheu nenhuma:
      // pendência vencida sem ninguém olhando é o que o líder precisa ver.
      const doFarmerPend = (pendencias.get(farmerId) ?? []).filter((p) => !p.eventoPassado)
      const statusFarmer = statusTram.get(farmerId)
      const abertas = doFarmerPend.filter((p) => !statusFarmer?.get(chaveTramitacao(p.ticketId, p.tipo))?.confirmadoEm)
      const placarTramitacoes = {
        pendentes: abertas.length,
        vencidas: abertas.filter((p) => p.diasParaPrazo < 0).length,
        escolhidas: 0, // preenchido abaixo
        aguardandoLider: abertas.filter((p) => statusFarmer?.get(chaveTramitacao(p.ticketId, p.tipo))?.feitoEm).length,
      }

      // O que o farmer escolheu tratar hoje na aba de tramitações.
      const escolhidas = [...(tramitacoes.get(farmerId)?.values() ?? [])]
        .filter((t) => t.selecionado)
        .map((t) => ({
          ticketId: t.ticketId,
          tipo: t.tipo,
          rotulo: TRAMITACOES[t.tipo as TipoTramitacao]?.label ?? t.tipo,
          assunto: t.assunto ?? `Ticket ${t.ticketId}`,
          resultado: t.resultado,
          observacao: t.observacao,
        }))

      placarTramitacoes.escolhidas = escolhidas.length

      return {
        farmerId,
        nome: FARMERS[farmerId] ?? farmerId,
        timeLabel: timeLabelPorFarmer[farmerId] ?? '',
        status: brief?.status ?? 'rascunho',
        primeiroAcesso: brief?.primeiroAcesso ?? null,
        comentarioLider: brief?.comentarioLider ?? null,
        itens: doFarmer,
        tramitacoes: escolhidas,
        placarTramitacoes,
        auxilios,
        // A empresa está na carteira errada: fica com o líder até ele decidir.
        trocas: [...(trocas.get(farmerId)?.values() ?? [])].map((t) => ({
          companyId: t.companyId,
          companyName: t.companyName,
          motivo: t.motivo,
          pedidoEm: t.pedidoEm,
        })),
        placar: {
          total: doDia.length,
          extras: doFarmer.length - doDia.length,
          efetivo: doDia.filter((i) => i.resultado === 'efetivo').length,
          tentativa: doDia.filter((i) => i.resultado === 'tentativa').length,
          naoAbordei: doDia.filter((i) => i.resultado === 'nao_abordei').length,
          trocaSegmento: doDia.filter((i) => i.resultado === 'trocar_segmento').length,
          pendente: doDia.filter((i) => !i.resultado).length,
        },
      }
    })

    return NextResponse.json({ usuario, data, agenda, resumo }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/agenda falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
