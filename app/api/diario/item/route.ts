import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { ABORDAGENS, farmersDoLider, RESULTADOS } from '@/lib/diario/constants'
import { atualizaItem, briefing, PatchItem } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await req.json()) as { data: string; companyId: string; farmerId?: string } & PatchItem

  // Farmer mexe no próprio dia; líder e gerência mexem no de quem está no time deles.
  let farmerId = usuario.id
  if (usuario.papel === 'lider') {
    farmerId = body.farmerId ?? ''
    if (!farmersDoLider(usuario.timeKey).includes(farmerId)) {
      return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
    }
  } else if (body.farmerId && body.farmerId !== usuario.id) {
    return NextResponse.json({ error: 'sem acesso a esse farmer' }, { status: 403 })
  }
  if (!body?.data || !body?.companyId) {
    return NextResponse.json({ error: 'data e companyId são obrigatórios' }, { status: 400 })
  }
  if (body.abordagem && !ABORDAGENS.includes(body.abordagem as (typeof ABORDAGENS)[number])) {
    return NextResponse.json({ error: 'abordagem inválida' }, { status: 400 })
  }
  if (body.resultado && !RESULTADOS.some((r) => r.key === body.resultado)) {
    return NextResponse.json({ error: 'resultado inválido' }, { status: 400 })
  }

  // Depois de revisado o dia fecha para o farmer, mas o líder ainda pode ajustar.
  if (usuario.papel === 'farmer') {
    const brief = await briefing(farmerId, body.data)
    if (brief.status === 'revisado') {
      return NextResponse.json({ error: 'o líder já revisou este dia' }, { status: 409 })
    }
  }

  await atualizaItem(farmerId, body.data, body.companyId, {
    abordagem: body.abordagem,
    observacao: body.observacao,
    resultado: body.resultado,
    observacaoResultado: body.observacaoResultado,
    // fica registrado quando quem editou não é o dono do dia
    editadoPor: usuario.papel === 'lider' ? usuario.nome : undefined,
  })
  return NextResponse.json({ ok: true })
}
