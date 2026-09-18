import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { emDescanso, precisaAuxilio, hojeSP, montaSugestoes } from '@/lib/diario/carteira'
import { poolDaCarteira, resumoDoMes } from '@/lib/diario/metrics'
import { itensDoDia, gravaSugestoes, briefing, historicoDoFarmer, orientacoesDe } from '@/lib/diario/db'

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

    const [resumo, brief, pool, historico, orientacoes] = await Promise.all([
      resumoDoMes([farmerId], data),
      briefing(farmerId, data),
      poolDaCarteira(farmerId, data),
      historicoDoFarmer(farmerId, data),
      orientacoesDe([farmerId]),
    ])
    const doFarmer = orientacoes.get(farmerId)

    // Contexto de cada empresa: quantas vezes já apareceu e o que aconteceu na última.
    const comHistorico = itens.map((i) => {
      const h = historico.get(i.companyId)
      const orientacao = doFarmer?.get(i.companyId) ?? null
      return {
        ...i,
        historico: h
          ? { aparicoes: h.aparicoes, ultimaData: h.ultimaData, ultimoResultado: h.ultimoResultado, tentativasSeguidas: h.tentativasSeguidas }
          : null,
        precisaAuxilio: precisaAuxilio(h),
        orientacao: orientacao ? { texto: orientacao.texto, autor: orientacao.autor, criadoEm: orientacao.criadoEm } : null,
      }
    })

    const descansando = [...historico.values()].filter((h) => emDescanso(h, data)).length
    const auxilio = comHistorico.filter((i) => i.precisaAuxilio).length

    return NextResponse.json(
      { usuario, farmerId, data, itens: comHistorico, pool: { ...pool, emDescanso: descansando, precisandoAuxilio: auxilio }, resumo, briefing: brief },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/dia falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
