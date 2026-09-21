import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { emDescanso, precisaAuxilio, hojeSP, montaSugestoes } from '@/lib/diario/carteira'
import { poolDaCarteira, resumoDoMes } from '@/lib/diario/metrics'
import { itensDoDia, gravaSugestoes, briefing, historicoDoFarmer, orientacoesDe, registraAcesso, atualizaItem } from '@/lib/diario/db'
import { empresasComSelo } from '@/lib/diario/relacionamento'
import { AtividadeEmpresa, atividadeDoDia } from '@/lib/diario/atividade'

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
    // Só conta como acesso quando é o próprio farmer abrindo: líder navegando
    // pelo seletor não pode parecer que o farmer entrou.
    if (usuario.papel === 'farmer' && farmerId === usuario.id && data === hojeSP()) {
      await registraAcesso(farmerId, data).catch(() => {})
    }

    let itens = await itensDoDia(farmerId, data)

    // Primeira abertura do dia: gera a lista e congela (refresh não reembaralha).
    if (itens.length === 0 && data === hojeSP()) {
      const sugestoes = await montaSugestoes(farmerId, data)
      await gravaSugestoes(sugestoes.itens)
      itens = await itensDoDia(farmerId, data)
    }

    const [resumo, brief, pool, historico, orientacoes, selos, atividade] = await Promise.all([
      resumoDoMes([farmerId], data),
      briefing(farmerId, data),
      poolDaCarteira(farmerId, data),
      historicoDoFarmer(farmerId, data),
      orientacoesDe([farmerId]),
      empresasComSelo(farmerId, itens.map((i) => i.companyId)).catch(() => new Set<string>()),
      atividadeDoDia(farmerId, data).catch((e) => { console.error('atividadeDoDia falhou:', e); return new Map<string, AtividadeEmpresa>() }),
    ])
    const doFarmer = orientacoes.get(farmerId)

    // A efetividade é automática: o que o HubSpot registrou hoje vira o resultado
    // da empresa sem ninguém precisar clicar. Só preenche o que está vazio —
    // escolha feita à mão pelo farmer ou pelo líder nunca é sobrescrita.
    for (const item of itens) {
      const a = atividade.get(item.companyId)
      if (!a?.resultadoSugerido) continue
      const preencheResultado = !item.resultado
      const preencheTexto = !item.observacaoResultado?.trim() && !!a.texto
      if (!preencheResultado && !preencheTexto) continue

      if (preencheResultado) item.resultado = a.resultadoSugerido
      if (preencheTexto) item.observacaoResultado = a.texto.slice(0, 600)
      await atualizaItem(farmerId, data, item.companyId, {
        ...(preencheResultado ? { resultado: a.resultadoSugerido } : {}),
        ...(preencheTexto ? { observacaoResultado: a.texto.slice(0, 600) } : {}),
      }).catch(() => {})
    }

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
        seloRelacionamento: selos.has(i.companyId),
        // o que já está registrado no HubSpot hoje: o fechamento vira conferência
        atividade: atividade.get(i.companyId) ?? null,
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
