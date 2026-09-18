import { NextResponse } from 'next/server'
import { FARMERS, TEAMS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { resumoDoMes } from '@/lib/diario/metrics'
import { itensMarcadosDoDia, briefingsDoDia, ItemDiario } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface AgendaFarmer {
  farmerId: string
  nome: string
  timeLabel: string
  status: string
  itens: ItemDiario[]
}

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'visão exclusiva do líder' }, { status: 403 })

  const data = new URL(req.url).searchParams.get('data') || hojeSP()
  const farmerIds = farmersDoLider(usuario.timeKey)

  try {
    const [itens, briefings, resumo] = await Promise.all([
      itensMarcadosDoDia(farmerIds, data),
      briefingsDoDia(farmerIds, data),
      resumoDoMes(farmerIds, data),
    ])

    const timeLabelPorFarmer: Record<string, string> = {}
    for (const time of Object.values(TEAMS)) {
      for (const id of time.farmerIds) timeLabelPorFarmer[id] = time.label
    }

    const agenda: AgendaFarmer[] = farmerIds.map((farmerId) => ({
      farmerId,
      nome: FARMERS[farmerId] ?? farmerId,
      timeLabel: timeLabelPorFarmer[farmerId] ?? '',
      status: briefings.find((b) => b.farmerId === farmerId)?.status ?? 'rascunho',
      itens: itens.filter((i) => i.farmerId === farmerId),
    }))

    return NextResponse.json({ usuario, data, agenda, resumo }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/agenda falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
