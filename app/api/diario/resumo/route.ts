import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, LIDERES } from '@/lib/diario/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { resumoDoMes } from '@/lib/diario/metrics'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Números do mês de um time, sob demanda.
 *
 * Existe separado da agenda porque calcular os quatro times junto com ela
 * somava sete segundos a toda abertura — e o filtro de time nem sempre é usado.
 */
export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const data = url.searchParams.get('data') || hojeSP()
  const time = url.searchParams.get('time')
  if (!time) return NextResponse.json({ error: 'time é obrigatório' }, { status: 400 })

  // Gerência vê qualquer time; líder de time, só o seu.
  const podeVer = usuario.papel === 'lider' && (!usuario.timeKey || usuario.timeKey === time)
  if (!podeVer) return NextResponse.json({ error: 'sem acesso a esse time' }, { status: 403 })
  if (!LIDERES.some((l) => l.timeKey === time)) {
    return NextResponse.json({ error: 'time desconhecido' }, { status: 404 })
  }

  try {
    const resumo = await resumoDoMes(farmersDoLider(time), data)
    return NextResponse.json({ time, resumo }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/resumo falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
