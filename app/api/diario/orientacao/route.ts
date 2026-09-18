import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { salvaOrientacao } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

/** Orientação do líder para uma empresa específica da carteira do farmer. */
export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'lider') {
    return NextResponse.json({ error: 'só o líder escreve orientação' }, { status: 403 })
  }

  const body = (await req.json()) as { farmerId?: string; companyId?: string; texto?: string }
  if (!body.farmerId || !body.companyId || !body.texto?.trim()) {
    return NextResponse.json({ error: 'farmerId, companyId e texto são obrigatórios' }, { status: 400 })
  }
  if (!farmersDoLider(usuario.timeKey).includes(body.farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }

  await salvaOrientacao({
    farmerId: body.farmerId,
    companyId: body.companyId,
    texto: body.texto.trim().slice(0, 1000),
    autor: usuario.nome,
    criadoEm: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true })
}
