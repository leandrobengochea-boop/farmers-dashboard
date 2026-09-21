import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import { resolveTrocaSegmento } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

/**
 * Decisão do líder sobre um pedido de troca de segmento. "trocado" fecha o
 * pedido (a empresa sai da carteira quando o proprietário muda no HubSpot);
 * "mantido" devolve a empresa ao rodízio do farmer.
 */
export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'lider') {
    return NextResponse.json({ error: 'só o líder decide a troca de segmento' }, { status: 403 })
  }

  const body = (await req.json()) as { farmerId?: string; companyId?: string; decisao?: string }
  if (!body?.farmerId || !body?.companyId) {
    return NextResponse.json({ error: 'farmerId e companyId são obrigatórios' }, { status: 400 })
  }
  if (body.decisao !== 'trocado' && body.decisao !== 'mantido') {
    return NextResponse.json({ error: 'decisão inválida' }, { status: 400 })
  }
  if (!farmersDoLider(usuario.timeKey).includes(body.farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }

  await resolveTrocaSegmento(body.farmerId, body.companyId, body.decisao, usuario.nome)
  return NextResponse.json({ ok: true })
}
