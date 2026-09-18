import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { ABORDAGENS, RESULTADOS } from '@/lib/diario/constants'
import { atualizaItem, briefing, PatchItem } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'farmer') {
    return NextResponse.json({ error: 'só o farmer edita o próprio diário' }, { status: 403 })
  }

  const body = (await req.json()) as { data: string; companyId: string } & PatchItem
  if (!body?.data || !body?.companyId) {
    return NextResponse.json({ error: 'data e companyId são obrigatórios' }, { status: 400 })
  }
  if (body.abordagem && !ABORDAGENS.includes(body.abordagem as (typeof ABORDAGENS)[number])) {
    return NextResponse.json({ error: 'abordagem inválida' }, { status: 400 })
  }
  if (body.resultado && !RESULTADOS.some((r) => r.key === body.resultado)) {
    return NextResponse.json({ error: 'resultado inválido' }, { status: 400 })
  }

  const brief = await briefing(usuario.id, body.data)
  if (brief.status === 'revisado') {
    return NextResponse.json({ error: 'o líder já revisou este dia' }, { status: 409 })
  }

  await atualizaItem(usuario.id, body.data, body.companyId, {
    abordagem: body.abordagem,
    observacao: body.observacao,
    resultado: body.resultado,
    observacaoResultado: body.observacaoResultado,
  })
  return NextResponse.json({ ok: true })
}
