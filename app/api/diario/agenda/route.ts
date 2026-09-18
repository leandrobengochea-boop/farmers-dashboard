import { NextResponse } from 'next/server'
import { FARMERS, TEAMS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { resumoDoMes } from '@/lib/diario/metrics'
import { itensDoDiaDeVarios, briefingsDoDia, ItemDiario } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface AgendaFarmer {
  farmerId: string
  nome: string
  timeLabel: string
  status: string
  comentarioLider: string | null
  itens: ItemDiario[]
  placar: { total: number; extras: number; efetivo: number; tentativa: number; naoAbordei: number; pendente: number }
}

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'visão exclusiva do líder' }, { status: 403 })

  const data = new URL(req.url).searchParams.get('data') || hojeSP()
  const farmerIds = farmersDoLider(usuario.timeKey)

  try {
    const [itens, briefings, resumo] = await Promise.all([
      itensDoDiaDeVarios(farmerIds, data),
      briefingsDoDia(farmerIds, data),
      resumoDoMes(farmerIds, data),
    ])

    const timeLabelPorFarmer: Record<string, string> = {}
    for (const time of Object.values(TEAMS)) {
      for (const id of time.farmerIds) timeLabelPorFarmer[id] = time.label
    }

    const agenda: AgendaFarmer[] = farmerIds.map((farmerId) => {
      const doFarmer = itens.filter((i) => i.farmerId === farmerId)
      // Os extras (clientes recentes) são bônus e não entram no placar do dia.
      const doDia = doFarmer.filter((i) => i.bucket !== 'extra')
      const brief = briefings.find((b) => b.farmerId === farmerId)
      return {
        farmerId,
        nome: FARMERS[farmerId] ?? farmerId,
        timeLabel: timeLabelPorFarmer[farmerId] ?? '',
        status: brief?.status ?? 'rascunho',
        comentarioLider: brief?.comentarioLider ?? null,
        itens: doFarmer,
        placar: {
          total: doDia.length,
          extras: doFarmer.length - doDia.length,
          efetivo: doDia.filter((i) => i.resultado === 'efetivo').length,
          tentativa: doDia.filter((i) => i.resultado === 'tentativa').length,
          naoAbordei: doDia.filter((i) => i.resultado === 'nao_abordei').length,
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
