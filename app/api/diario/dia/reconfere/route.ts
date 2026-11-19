import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { COOLDOWN_CONTATO_CRM, farmersDoLider } from '@/lib/diario/constants'
import { hojeSP, montaSugestoes } from '@/lib/diario/carteira'
import { contatoEfetivoNoCRM } from '@/lib/diario/conversas'
import { briefing, gravaSugestoes, itensDoDia, removeItensIntocados } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function menosDias(iso: string, dias: number): string {
  return new Date(new Date(`${iso}T12:00:00Z`).getTime() - dias * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Reconfere a lista de hoje de um farmer contra o CRM.
 *
 * Existe porque a lista é congelada na primeira abertura do dia: quando uma
 * regra muda de manhã, quem já abriu fica com a lista velha até amanhã. Aqui a
 * mesma conferência da geração roda de novo, sobre o dia que já existe.
 *
 * O que já foi trabalhado não é tocado — empresa com resultado, com observação
 * escrita ou editada pelo líder fica onde está, mesmo que a regra nova a
 * derrubasse. Dia já revisado pelo líder não é mexido de jeito nenhum: o
 * placar dele já virou conversa.
 *
 * Um farmer por chamada: a conferência consulta o CRM empresa por empresa e o
 * time inteiro numa requisição só estouraria o tempo da função.
 */
export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'só o líder reconfere a lista' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { farmerId?: string }
  const farmerId = body.farmerId
  if (!farmerId) return NextResponse.json({ error: 'farmerId é obrigatório' }, { status: 400 })
  if (!farmersDoLider(usuario.timeKey).includes(farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }

  const hoje = hojeSP()
  try {
    const [itens, brief] = await Promise.all([itensDoDia(farmerId, hoje), briefing(farmerId, hoje)])
    if (itens.length === 0) {
      return NextResponse.json({ farmerId, estado: 'sem lista', removidas: 0, repostas: 0 })
    }
    if (brief.status === 'revisado') {
      return NextResponse.json({ farmerId, estado: 'dia revisado', removidas: 0, repostas: 0 })
    }

    // Só entram na conferência as que ninguém encostou ainda.
    const intocadas = itens.filter((i) => !i.resultado && !i.editadoPor && !i.observacao)
    const contato = await contatoEfetivoNoCRM(
      intocadas.map((i) => i.companyId),
      menosDias(hoje, COOLDOWN_CONTATO_CRM),
    )
    const alvo = intocadas.filter((i) => contato.has(i.companyId)).map((i) => i.companyId)
    const removidas = await removeItensIntocados(farmerId, hoje, alvo)
    if (removidas.length === 0) {
      return NextResponse.json({ farmerId, estado: 'nada a trocar', removidas: 0, repostas: 0 })
    }

    // Repõe o que saiu, da mesma fila de prioridade e já conferido — a lista do
    // farmer não encolhe por causa de uma correção de regra.
    const ficaram = new Set(itens.filter((i) => !removidas.includes(i.companyId)).map((i) => i.companyId))
    const novas = await montaSugestoes(farmerId, hoje, { excluir: ficaram })
    const repostas = novas.itens.filter((i) => !ficaram.has(i.companyId)).slice(0, removidas.length)
    await gravaSugestoes(repostas)

    return NextResponse.json({
      farmerId,
      estado: 'atualizada',
      removidas: removidas.length,
      repostas: repostas.length,
      empresas: repostas.map((i) => i.companyName),
    })
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/dia/reconfere falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
