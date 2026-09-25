import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, LIDERES } from '@/lib/diario/constants'
import { dealInTeam } from '@/lib/constants'
import { hojeSP } from '@/lib/diario/carteira'
import { DiaDoFarmer, serieDoPeriodo } from '@/lib/diario/db'

export const dynamic = 'force-dynamic'

/** Composição de um conjunto de dias: a soma é sempre `setadas`. */
export interface Composicao {
  setadas: number
  efetivo: number
  tentativa: number
  naoAbordei: number
  semRegistro: number
  trocaSegmento: number
  pctEfetivo: number
}

const zero = (): Composicao => ({
  setadas: 0, efetivo: 0, tentativa: 0, naoAbordei: 0, semRegistro: 0, trocaSegmento: 0, pctEfetivo: 0,
})

function soma(alvo: Composicao, d: DiaDoFarmer): void {
  alvo.setadas += d.setadas
  alvo.efetivo += d.efetivo
  alvo.tentativa += d.tentativa
  alvo.naoAbordei += d.naoAbordei
  alvo.semRegistro += d.semRegistro
  alvo.trocaSegmento += d.trocaSegmento
}

const fecha = (c: Composicao): Composicao => ({
  ...c, pctEfetivo: c.setadas > 0 ? Math.round((c.efetivo / c.setadas) * 100) : 0,
})

function menosDias(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const usuario = usuarioAtual()
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const ate = url.searchParams.get('ate') || hojeSP()
  const dias = Math.min(Math.max(parseInt(url.searchParams.get('dias') ?? '14', 10) || 14, 1), 90)
  const de = menosDias(ate, dias - 1)

  const farmerIds = usuario.papel === 'lider' ? farmersDoLider(usuario.timeKey) : [usuario.id]
  // Quem enxerga mais de um time compara os times; líder de time compara os farmers.
  const gerencia = usuario.papel === 'lider' && !usuario.timeKey

  try {
    const serie = await serieDoPeriodo(farmerIds, de, ate)

    const porDia = new Map<string, Composicao>()
    for (const d of serie) {
      if (!porDia.has(d.data)) porDia.set(d.data, zero())
      soma(porDia.get(d.data)!, d)
    }

    // O time é o daquele dia, não o de hoje: quem mudou de time em 25/09 leva o
    // que fez antes para a formação antiga, senão o histórico do time se altera
    // sozinho toda vez que alguém troca de líder.
    const times = gerencia
      ? LIDERES.filter((l) => l.timeKey).map((l) => {
          const total = zero()
          const dias = new Map<string, Composicao>()
          for (const d of serie) {
            if (!dealInTeam(d.farmerId, d.data, l.timeKey as string)) continue
            soma(total, d)
            if (!dias.has(d.data)) dias.set(d.data, zero())
            soma(dias.get(d.data)!, d)
          }
          return {
            timeKey: l.timeKey as string,
            lider: l.nome,
            total: fecha(total),
            dias: [...dias.entries()].sort().map(([data, c]) => ({ data, ...fecha(c) })),
          }
        })
      : []

    const total = zero()
    for (const d of serie) soma(total, d)

    return NextResponse.json(
      {
        de, ate,
        dias: [...porDia.entries()].sort().map(([data, c]) => ({ data, ...fecha(c) })),
        total: fecha(total),
        times,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/evolucao falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
