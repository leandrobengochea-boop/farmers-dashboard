import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { hojeSP, montaSugestoes } from '@/lib/diario/carteira'
import { poolDaCarteira, resumoDoMes } from '@/lib/diario/metrics'
import { COOLDOWN_DIAS } from '@/lib/diario/constants'
import { itensDoDia, gravaSugestoes, briefing, empresasEmCooldown } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const data = url.searchParams.get('data') || hojeSP()
  const pedido = url.searchParams.get('farmerId')

  // Farmer só vê o próprio dia. Líder vê qualquer farmer do seu time.
  let farmerId = usuario.id
  if (usuario.papel === 'lider') {
    const doTime = farmersDoLider(usuario.timeKey)
    farmerId = pedido && doTime.includes(pedido) ? pedido : doTime[0]
  } else if (pedido && pedido !== usuario.id) {
    return NextResponse.json({ error: 'sem acesso a esse farmer' }, { status: 403 })
  }

  try {
    let itens = await itensDoDia(farmerId, data)

    // Primeira abertura do dia: gera a lista e congela (refresh não reembaralha).
    if (itens.length === 0 && data === hojeSP()) {
      const sugestoes = await montaSugestoes(farmerId, data)
      await gravaSugestoes(sugestoes.itens)
      itens = await itensDoDia(farmerId, data)
    }

    const [resumo, brief, pool, cooldown] = await Promise.all([
      resumoDoMes([farmerId], data),
      briefing(farmerId, data),
      poolDaCarteira(farmerId, data),
      empresasEmCooldown(farmerId, COOLDOWN_DIAS, data),
    ])

    return NextResponse.json(
      { usuario, farmerId, data, itens, pool: { ...pool, emDescanso: cooldown.size }, resumo, briefing: brief },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/dia falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
