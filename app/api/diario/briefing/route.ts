import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, MINIMO_OBSERVACAO, RESULTADO_EXIGE_OBSERVACAO, Resultado } from '@/lib/diario/constants'
import { itensDoDia, briefing, salvaBriefing } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await req.json()) as {
    acao: 'planejar' | 'fechar' | 'revisar'
    data: string
    farmerId?: string
    comentario?: string
  }
  const agora = new Date().toISOString()

  if (body.acao === 'planejar' || body.acao === 'fechar') {
    if (usuario.papel !== 'farmer') {
      return NextResponse.json({ error: 'só o farmer fecha o próprio dia' }, { status: 403 })
    }
    // Todas as empresas do dia entram na conferência, extras inclusive.
    const doDia = await itensDoDia(usuario.id, body.data)
    if (doDia.length === 0) {
      return NextResponse.json({ error: 'nenhuma empresa na lista de hoje' }, { status: 400 })
    }
    const atual = await briefing(usuario.id, body.data)

    if (body.acao === 'planejar') {
      const semAbordagem = doDia.filter((i) => !i.abordagem)
      if (semAbordagem.length > 0) {
        return NextResponse.json(
          { error: `${semAbordagem.length} empresa(s) sem abordagem definida`, empresas: semAbordagem.map((i) => i.companyName) },
          { status: 400 },
        )
      }
      await salvaBriefing({ ...atual, status: 'planejado', enviadoEm: agora })
      return NextResponse.json({ ok: true, empresas: doDia.length })
    }

    const semResultado = doDia.filter((i) => !i.resultado)
    if (semResultado.length > 0) {
      return NextResponse.json(
        { error: `${semResultado.length} empresa(s) sem resultado registrado`, empresas: semResultado.map((i) => i.companyName) },
        { status: 400 },
      )
    }
    const semObservacao = doDia.filter(
      (i) => RESULTADO_EXIGE_OBSERVACAO.includes(i.resultado as Resultado) &&
        (i.observacaoResultado?.trim().length ?? 0) < MINIMO_OBSERVACAO,
    )
    if (semObservacao.length > 0) {
      return NextResponse.json(
        {
          error: `${semObservacao.length} empresa(s) com observação abaixo de ${MINIMO_OBSERVACAO} caracteres`,
          empresas: semObservacao.map((i) => i.companyName),
        },
        { status: 400 },
      )
    }
    await salvaBriefing({ ...atual, status: 'fechado', decididoEm: agora })
    return NextResponse.json({ ok: true, empresas: doDia.length })
  }

  if (usuario.papel !== 'lider') return NextResponse.json({ error: 'só o líder revisa' }, { status: 403 })
  const farmerId = body.farmerId ?? ''
  if (!farmersDoLider(usuario.timeKey).includes(farmerId)) {
    return NextResponse.json({ error: 'farmer fora do seu time' }, { status: 403 })
  }
  const atual = await briefing(farmerId, body.data)
  await salvaBriefing({
    ...atual,
    status: 'revisado',
    decididoEm: agora,
    decididoPor: usuario.nome,
    comentarioLider: body.comentario || atual.comentarioLider,
  })
  return NextResponse.json({ ok: true })
}
