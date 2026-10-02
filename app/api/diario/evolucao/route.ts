import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider, farmersDoPeriodoNoDiario, LIDERES } from '@/lib/diario/constants'
import { dealInTeam, FARMERS } from '@/lib/constants'
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

  // Quem esteve no time durante a janela, não só quem está hoje: senão o
  // histórico encolhe toda vez que alguém sai.
  const farmerIds = usuario.papel === 'lider'
    ? farmersDoPeriodoNoDiario(usuario.timeKey, de, ate)
    : [usuario.id]
  // Quem enxerga mais de um time compara os times; líder de time compara os farmers.
  const gerencia = usuario.papel === 'lider' && !usuario.timeKey

  try {
    const bruta = await serieDoPeriodo(farmerIds, de, ate)
    // O geral tem que fechar com a soma dos times da tela. Dia que pertenceu a
    // um time que saiu do diário (o do Dani, em out/26) fica de fora dos dois,
    // senão sobra diferença que ninguém consegue explicar.
    const serie = gerencia
      ? bruta.filter((d) => LIDERES.some((l) => l.timeKey && dealInTeam(d.farmerId, d.data, l.timeKey)))
      : bruta

    const porDia = new Map<string, Composicao>()
    for (const d of serie) {
      if (!porDia.has(d.data)) porDia.set(d.data, zero())
      soma(porDia.get(d.data)!, d)
    }

    // O time é o daquele dia, não o de hoje: quem mudou de time em 25/09 leva o
    // que fez antes para a formação antiga, senão o histórico do time se altera
    // sozinho toda vez que alguém troca de líder.
    // Por farmer, sobre as linhas que interessam. Recebe um filtro porque o
    // recorte de time é por DATA: quem mudou de time aparece nos dois, cada um
    // com os dias que foram dele.
    const porFarmer = (vale: (d: DiaDoFarmer) => boolean) => {
      const mapa = new Map<string, Composicao>()
      for (const d of serie) {
        if (!vale(d)) continue
        if (!mapa.has(d.farmerId)) mapa.set(d.farmerId, zero())
        soma(mapa.get(d.farmerId)!, d)
      }
      return [...mapa.entries()]
        .map(([farmerId, c]) => ({ farmerId, nome: FARMERS[farmerId] ?? farmerId, ...fecha(c) }))
        .sort((a, b) => b.pctEfetivo - a.pctEfetivo || b.setadas - a.setadas)
    }

    const times = gerencia
      ? LIDERES.filter((l) => l.timeKey).map((l) => {
          const doTime = (d: DiaDoFarmer) => dealInTeam(d.farmerId, d.data, l.timeKey as string)
          const total = zero()
          const dias = new Map<string, Composicao>()
          for (const d of serie) {
            if (!doTime(d)) continue
            soma(total, d)
            if (!dias.has(d.data)) dias.set(d.data, zero())
            soma(dias.get(d.data)!, d)
          }
          return {
            timeKey: l.timeKey as string,
            lider: l.nome,
            total: fecha(total),
            dias: [...dias.entries()].sort().map(([data, c]) => ({ data, ...fecha(c) })),
            farmers: porFarmer(doTime),
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
        farmers: porFarmer(() => true),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : 'erro desconhecido'
    console.error('diario/evolucao falhou:', erro)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
