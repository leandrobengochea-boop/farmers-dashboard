import { FARMERS, CRITERIA, HUBSPOT_PORTAL_ID } from './constants'

export interface Deal {
  id: string
  name: string
  farmerId: string
  farmerName: string
  score: number
  criteria: string[]
  date: string
  hubspotUrl: string
  pipeline: string
  closedLostReason: string
}

export interface FetchValidation {
  totalBruto: number
  excludedFora: number
  totalLiquido: number
}

export interface FetchResult {
  deals: Deal[]
  validation: FetchValidation
}

function normalizeCriterionKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function matchCriteria(criteriosAtendidos: string | null | undefined): string[] {
  if (!criteriosAtendidos) return []

  const rawValues = criteriosAtendidos
    .split(/[;,|]/)
    .map((v) => v.trim())
    .filter(Boolean)

  const matched: string[] = []

  for (const rawValue of rawValues) {
    const normalized = normalizeCriterionKey(rawValue)

    for (const criterion of CRITERIA) {
      if (matched.includes(criterion.key)) continue

      const criterionNormalized = normalizeCriterionKey(criterion.key)

      if (normalized === criterionNormalized) {
        matched.push(criterion.key)
        break
      }

      const keyParts = criterionNormalized.split('_').filter((p) => p.length > 3)
      if (keyParts.some((part) => normalized.includes(part))) {
        matched.push(criterion.key)
        break
      }

      const valueParts = normalized.split('_').filter((p) => p.length > 3)
      if (valueParts.some((part) => criterionNormalized.includes(part))) {
        matched.push(criterion.key)
        break
      }
    }
  }

  return matched
}

function isForaDoMOA(closedLostReason: string | null | undefined): boolean {
  if (!closedLostReason) return false
  const normalized = normalizeCriterionKey(closedLostReason)
  return normalized.includes('fora') && normalized.includes('moa')
}

export async function fetchAllDeals(): Promise<FetchResult> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT environment variable is not set')

  const farmerIds = Object.keys(FARMERS)
  const rawDeals: Deal[] = []
  let after: string | undefined = undefined

  function buildBody(cursor?: string): string {
    const payload: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'sdrfarmer_responsavel',
              operator: 'IN',
              values: farmerIds,
            },
            {
              propertyName: 'pipedrive___data_de_qualificacao',
              operator: 'GTE',
              value: '1746057600000',
            },
            {
              propertyName: 'pontuacao_leadscore',
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      properties: [
        'dealname',
        'sdrfarmer_responsavel',
        'pontuacao_leadscore',
        'criterios_atendidos',
        'pipedrive___data_de_qualificacao',
        'pipeline',
        'closed_lost_reason',
      ],
      limit: 200,
    }
    if (cursor) payload.after = cursor
    return JSON.stringify(payload)
  }

  while (true) {
    const resp = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: buildBody(after),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`HubSpot API error: ${resp.status} - ${errText}`)
    }

    const data = await resp.json() as {
      results?: Array<{ id: string; properties: Record<string, string> }>
      paging?: { next?: { after?: string } }
    }

    for (const deal of (data.results ?? [])) {
      const props = deal.properties ?? {}
      const farmerId = props.sdrfarmer_responsavel ?? ''
      const dateMs = props.pipedrive___data_de_qualificacao
        ? parseInt(props.pipedrive___data_de_qualificacao, 10)
        : 0

      rawDeals.push({
        id: deal.id,
        name: props.dealname ?? `Deal ${deal.id}`,
        farmerId,
        farmerName: FARMERS[farmerId] ?? farmerId,
        score: parseFloat(props.pontuacao_leadscore ?? '0') || 0,
        criteria: matchCriteria(props.criterios_atendidos),
        date: dateMs ? new Date(dateMs).toISOString() : '',
        hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${deal.id}`,
        pipeline: props.pipeline ?? '',
        closedLostReason: props.closed_lost_reason ?? '',
      })
    }

    const nextAfter = data.paging?.next?.after
    if (!nextAfter) break
    after = nextAfter
  }

  const totalBruto = rawDeals.length
  const excluded = rawDeals.filter((d) => isForaDoMOA(d.closedLostReason))
  const excludedFora = excluded.length
  const deals = rawDeals.filter((d) => !isForaDoMOA(d.closedLostReason))

  return {
    deals,
    validation: {
      totalBruto,
      excludedFora,
      totalLiquido: deals.length,
    },
  }
}
