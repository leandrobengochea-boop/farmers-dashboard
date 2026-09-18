import {
  ORIGIN_CUTOVER, ALLOWED_ORIGEM_DO_LEAD, ALLOWED_ORIGEM_QUALIFICACAO,
} from '../constants'
import { TICKET_PIPELINE_CS, TICKET_STAGES_ATIVOS, WON_STAGES } from './constants'
import { fetchWithRetry, searchAllPages } from './carteira'

export interface ResumoMes {
  oportunidadesCriadas: number
  ticketsAtivos: number
  receitaGerada: number
  carteira: number
  empresasComContatoEfetivo: number
  pctContatoEfetivo: number
  mes: string
}

function limitesDoMes(hoje: string): { inicio: string; fimExclusivo: string; inicioMs: string; fimMs: string } {
  const inicio = `${hoje.slice(0, 7)}-01`
  const d = new Date(`${inicio}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  const fimExclusivo = d.toISOString().slice(0, 10)
  return {
    inicio,
    fimExclusivo,
    inicioMs: String(new Date(`${inicio}T00:00:00Z`).getTime()),
    fimMs: String(new Date(`${fimExclusivo}T00:00:00Z`).getTime()),
  }
}

function normaliza(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_')
}

function foraDoMOA(closedLost: string, motivo: string): boolean {
  return [closedLost, motivo].some((v) => {
    if (!v) return false
    const n = normaliza(v)
    return n.includes('fora') && n.includes('moa')
  })
}

/** Contagem barata: usa só o `total` da busca, sem paginar. */
async function conta(pat: string, objectType: string, filters: Record<string, unknown>[]): Promise<number> {
  const resp = await fetchWithRetry(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups: [{ filters }], properties: ['hs_object_id'], limit: 1 }),
    cache: 'no-store',
  })
  if (!resp.ok) {
    console.error(`contagem de ${objectType} falhou:`, resp.status, await resp.text())
    return 0
  }
  const data = (await resp.json()) as { total?: number }
  return data.total ?? 0
}

/**
 * Cabeçalho do diário para um ou mais farmers.
 * Segue as mesmas regras dos outros dashboards: filtro de origem a partir do
 * cutover de julho/26 e exclusão de negócios marcados como Fora do MOA.
 */
export async function resumoDoMes(farmerIds: string[], hoje: string): Promise<ResumoMes> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')
  if (farmerIds.length === 0) {
    return { oportunidadesCriadas: 0, ticketsAtivos: 0, receitaGerada: 0, carteira: 0, empresasComContatoEfetivo: 0, pctContatoEfetivo: 0, mes: hoje.slice(0, 7) }
  }

  const { inicioMs, fimMs } = limitesDoMes(hoje)
  const cutoverMs = new Date(ORIGIN_CUTOVER).getTime()

  const [criados, ganhos, ticketsAtivos, carteira, comContato] = await Promise.all([
    searchAllPages(pat, 'deals', [{ filters: [
      { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: farmerIds },
      { propertyName: 'pipedrive___data_de_qualificacao', operator: 'GTE', value: inicioMs },
      { propertyName: 'pipedrive___data_de_qualificacao', operator: 'LT', value: fimMs },
    ] }], [
      'origem_do_lead', 'origem_da_qualificacao', 'closed_lost_reason',
      'motivo_de_sinalizacao_de_perda', 'pipedrive___data_de_qualificacao',
    ]).catch(() => []),

    searchAllPages(pat, 'deals', [{ filters: [
      { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: farmerIds },
      { propertyName: 'closedate', operator: 'GTE', value: inicioMs },
      { propertyName: 'closedate', operator: 'LT', value: fimMs },
      { propertyName: 'dealstage', operator: 'IN', values: WON_STAGES },
    ] }], ['amount_in_home_currency']).catch(() => []),

    conta(pat, 'tickets', [
      { propertyName: 'hubspot_owner_id', operator: 'IN', values: farmerIds },
      { propertyName: 'hs_pipeline', operator: 'EQ', value: TICKET_PIPELINE_CS },
      { propertyName: 'hs_pipeline_stage', operator: 'IN', values: TICKET_STAGES_ATIVOS },
    ]).catch(() => 0),

    conta(pat, 'companies', [
      { propertyName: 'hubspot_owner_id', operator: 'IN', values: farmerIds },
    ]).catch(() => 0),

    conta(pat, 'companies', [
      { propertyName: 'hubspot_owner_id', operator: 'IN', values: farmerIds },
      // propriedades de data no REST só aceitam timestamp em ms
      { propertyName: 'ultimo_contato_efetivo', operator: 'GTE', value: inicioMs },
    ]).catch(() => 0),
  ])

  const oportunidadesCriadas = criados.filter((d) => {
    const p = d.properties
    if (foraDoMOA(p.closed_lost_reason ?? '', p.motivo_de_sinalizacao_de_perda ?? '')) return false
    const dataQual = p.pipedrive___data_de_qualificacao ?? ''
    const ts = /^\d{10,}$/.test(dataQual) ? parseInt(dataQual, 10) : new Date(dataQual).getTime()
    if (ts >= cutoverMs) {
      const okLead = ALLOWED_ORIGEM_DO_LEAD.includes(p.origem_do_lead ?? '')
      const okQual = ALLOWED_ORIGEM_QUALIFICACAO.includes(p.origem_da_qualificacao ?? '')
      if (!okLead && !okQual) return false
    }
    return true
  }).length

  const receitaGerada = ganhos.reduce((soma, d) => soma + (parseFloat(d.properties.amount_in_home_currency ?? '0') || 0), 0)

  return {
    oportunidadesCriadas,
    ticketsAtivos,
    receitaGerada,
    carteira,
    empresasComContatoEfetivo: comContato,
    pctContatoEfetivo: carteira > 0 ? Math.round((comContato / carteira) * 100) : 0,
    mes: hoje.slice(0, 7),
  }
}

export interface PoolCarteira {
  carteira: number
  recompra: number
  reativacao: number
  extra: number
  semHistorico: number
  negociosAbertos: number
}

function msMenosMeses(hoje: string, meses: number): string {
  const d = new Date(`${hoje}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - meses)
  return String(d.getTime())
}

/**
 * Tamanho de cada balde na carteira do farmer — contagens baratas (só o total
 * da busca), para mostrar quando o pool está abaixo da cota diária.
 */
export async function poolDaCarteira(farmerId: string, hoje: string): Promise<PoolCarteira> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  const dono = { propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId }
  const ms3 = msMenosMeses(hoje, 3)
  const ms8 = msMenosMeses(hoje, 8)
  const ms12 = msMenosMeses(hoje, 12)

  const [carteira, recompra, reativacao, extra, semHistorico, negociosAbertos] = await Promise.all([
    conta(pat, 'companies', [dono]).catch(() => 0),
    conta(pat, 'companies', [dono,
      { propertyName: 'data_da_ultima_compra', operator: 'GT', value: ms12 },
      { propertyName: 'data_da_ultima_compra', operator: 'LTE', value: ms8 },
    ]).catch(() => 0),
    conta(pat, 'companies', [dono,
      { propertyName: 'data_da_ultima_compra', operator: 'LTE', value: ms12 },
    ]).catch(() => 0),
    conta(pat, 'companies', [dono,
      { propertyName: 'data_da_ultima_compra', operator: 'GT', value: ms3 },
    ]).catch(() => 0),
    conta(pat, 'companies', [dono,
      { propertyName: 'data_da_ultima_compra', operator: 'NOT_HAS_PROPERTY' },
    ]).catch(() => 0),
    conta(pat, 'deals', [
      { propertyName: 'sdrfarmer_responsavel', operator: 'EQ', value: farmerId },
      { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' },
    ]).catch(() => 0),
  ])

  return { carteira, recompra, reativacao, extra, semHistorico, negociosAbertos }
}
