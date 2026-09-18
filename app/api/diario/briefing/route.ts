import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { itensDoDia, briefing, salvaBriefing } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await req.json()) as { acao: 'enviar' | 'aprovar' | 'ajustar'; data: string; farmerId?: string; comentario?: string }
  const agora = new Date().toISOString()

  if (body.acao === 'enviar') {
    if (usuario.papel !== 'farmer') return NextResponse.json({ error: 'só o farmer envia o próprio briefing' }, { status: 403 })

    const itens = await itensDoDia(usuario.id, body.data)
    const marcados = itens.filter((i) => i.marcado)
    if (marcados.length === 0) {
      return NextResponse.json({ error: 'marque ao menos uma empresa' }, { status: 400 })
    }
    const incompletos = marcados.filter((i) => !i.abordagem || !i.observacao?.trim())
    if (incompletos.length > 0) {
      return NextResponse.json(
        { error: `${incompletos.length} empresa(s) sem abordagem ou observação`, empresas: incompletos.map((i) => i.companyName) },
        { status: 400 },
      )
    }
    const atual = await briefing(usuario.id, body.data)
    await salvaBriefing({ ...atual, status: 'enviado', enviadoEm: agora, decididoEm: null, decididoPor: null })
    return NextResponse.json({ ok: true, marcados: marcados.length })
  }

  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'só o líder decide' }, { status: 403 })
  const farmerId = body.farmerId ?? ''
  if (!farmersDoLider(usuario.timeKey).includes(farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }

  const atual = await briefing(farmerId, body.data)
  await salvaBriefing({
    ...atual,
    status: body.acao === 'aprovar' ? 'aprovado' : 'ajustar',
    decididoEm: agora,
    decididoPor: usuario.nome,
    comentarioLider: body.comentario ?? null,
  })
  return NextResponse.json({ ok: true })
}
