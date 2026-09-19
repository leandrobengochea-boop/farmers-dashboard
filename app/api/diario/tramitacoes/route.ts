import { NextResponse } from 'next/server'
import { FARMERS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, RESULTADOS_TRAMITACAO, TRAMITACOES, TipoTramitacao } from '@/lib/diario/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { pendenciasDoFarmer } from '@/lib/diario/tramitacoes'
import {
  atualizaTramitacaoDia, chaveTramitacao, confirmaTramitacao, marcaFeito,
  statusTramitacoes, tramitacoesDoDia,
} from '@/lib/diario/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function resolveFarmer(usuario: { id: string; papel: string; timeKey: string | null }, pedido: string | null): string | null {
  if (usuario.papel === 'lider') {
    const doTime = farmersDoLider(usuario.timeKey)
    return pedido && doTime.includes(pedido) ? pedido : doTime[0] ?? null
  }
  if (pedido && pedido !== usuario.id) return null
  return usuario.id
}

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const data = url.searchParams.get('data') || hojeSP()
  const farmerId = resolveFarmer(usuario, url.searchParams.get('farmerId'))
  if (!farmerId) return NextResponse.json({ error: 'sem acesso a esse farmer' }, { status: 403 })

  try {
    const doTime = usuario.papel === 'lider' ? farmersDoLider(usuario.timeKey) : [farmerId]
    const [pendencias, status, dias] = await Promise.all([
      pendenciasDoFarmer(farmerId, data),
      statusTramitacoes(doTime),
      tramitacoesDoDia(doTime, data),
    ])

    const statusFarmer = status.get(farmerId)
    const diaFarmer = dias.get(farmerId)

    // Some do board só quando o líder confirma — marcar como feito não basta.
    const lista = pendencias
      .map((p) => {
        const chave = chaveTramitacao(p.ticketId, p.tipo)
        const st = statusFarmer?.get(chave)
        const dia = diaFarmer?.get(chave)
        return {
          ...p,
          feitoEm: st?.feitoEm ?? null,
          confirmadoEm: st?.confirmadoEm ?? null,
          confirmadoPor: st?.confirmadoPor ?? null,
          selecionado: dia?.selecionado ?? false,
          resultado: dia?.resultado ?? null,
          observacao: dia?.observacao ?? null,
        }
      })
      .filter((p) => !p.confirmadoEm)

    // Painel do líder: o que a equipe marcou como feito e espera confirmação.
    const aguardando = usuario.papel === 'lider'
      ? doTime.flatMap((id) =>
          [...(status.get(id)?.values() ?? [])]
            .filter((s) => s.feitoEm && !s.confirmadoEm)
            .map((s) => ({
              farmerId: id,
              nome: FARMERS[id] ?? id,
              ticketId: s.ticketId,
              tipo: s.tipo,
              assunto: s.assunto ?? `Ticket ${s.ticketId}`,
              feitoEm: s.feitoEm,
              rotulo: TRAMITACOES[s.tipo as TipoTramitacao]?.label ?? s.tipo,
            })),
        )
      : []

    return NextResponse.json(
      { usuario, farmerId, data, pendencias: lista, aguardando, tipos: TRAMITACOES, resultados: RESULTADOS_TRAMITACAO },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/tramitacoes falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Seleção do dia e registro do resultado — só o farmer. */
export async function PATCH(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  if (usuario.papel !== 'farmer') {
    return NextResponse.json({ error: 'só o farmer edita o próprio dia' }, { status: 403 })
  }

  const body = (await req.json()) as {
    data: string; ticketId: string; tipo: string
    selecionado?: boolean; resultado?: string | null; observacao?: string | null
  }
  if (!body?.data || !body?.ticketId || !body?.tipo) {
    return NextResponse.json({ error: 'data, ticketId e tipo são obrigatórios' }, { status: 400 })
  }
  if (body.resultado && !RESULTADOS_TRAMITACAO.some((r) => r.key === body.resultado)) {
    return NextResponse.json({ error: 'resultado inválido' }, { status: 400 })
  }

  await atualizaTramitacaoDia(usuario.id, body.data, body.ticketId, body.tipo, {
    selecionado: body.selecionado,
    resultado: body.resultado,
    observacao: body.observacao,
  })
  return NextResponse.json({ ok: true })
}

/** Dupla checagem: o farmer marca, o líder confirma. */
export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await req.json()) as {
    acao: 'feito' | 'desfazer' | 'confirmar' | 'reabrir'
    ticketId: string; tipo: string; farmerId?: string; assunto?: string
  }
  if (!body?.ticketId || !body?.tipo) {
    return NextResponse.json({ error: 'ticketId e tipo são obrigatórios' }, { status: 400 })
  }
  if (!TRAMITACOES[body.tipo as TipoTramitacao]) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }

  if (body.acao === 'feito' || body.acao === 'desfazer') {
    if (usuario.papel !== 'farmer') {
      return NextResponse.json({ error: 'só o farmer marca a própria tramitação' }, { status: 403 })
    }
    await marcaFeito(usuario.id, body.ticketId, body.tipo, body.acao === 'feito', body.assunto ?? '')
    return NextResponse.json({ ok: true })
  }

  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'só o líder confirma' }, { status: 403 })
  const farmerId = body.farmerId ?? ''
  if (!farmersDoLider(usuario.timeKey).includes(farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }
  await confirmaTramitacao(farmerId, body.ticketId, body.tipo, usuario.nome, body.acao === 'confirmar')
  return NextResponse.json({ ok: true })
}
