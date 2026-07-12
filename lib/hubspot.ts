import {
  FARMERS, FARMER_ALIASES, FARMER_DATE_RESTRICTIONS, CRITERIA, HUBSPOT_PORTAL_ID,
  ORIGIN_CUTOVER, ALLOWED_ORIGEM_DO_LEAD, ALLOWED_ORIGEM_QUALIFICACAO,
} from './constants'

export interface Deal {
  id: string
  name: string
  farmerId: string
  farmerName: string
  score: number
  criteria: string[]
  date: string           // pipedrive___data_de_qualificacao
  hubspotUrl: string
  pipeline: string
  closedLostReason: string
  createDate: string     // createdate
  lastModifiedDate: string // hs_lastmodifieddate
  dealStage: string      // dealstage
  meetingScheduled: boolean  // tem reunião real associada no CRM (qualquer outcome)
  meetingCompleted: boolean  // tem reunião associada com hs_meeting_outcome=COMPLETED
  ownerName: string      // hubspot_owner_id → owner display name
  isScored: boolean      // has pontuacao_leadscore — false = "Fora do SAL"
  companyId: string      // empresa associada (associação primária) — '' se nenhuma
  origemDoLead: string   // origem_do_lead
  origemQualificacao: string // origem_da_qualificacao
  ownerId: string        // hubspot_owner_id (raw)
}

export interface FetchValidation {
  totalBruto: number
  excludedFora: number
  totalLiquido: number
}

export interface ForaDoMOAEntry {
  farmerName: string
  count: number
}

export interface ExcludedDeal {
  id: string
  name: string
  farmerId: string
  farmerName: string
  date: string
  hubspotUrl: string
}

export interface FetchResult {
  deals: Deal[]
  validation: FetchValidation
  foraDoMOA: ForaDoMOAEntry[]
  excludedDeals: ExcludedDeal[]
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

async function fetchOwnerMap(pat: string): Promise<Record<string, string>> {
  const resp = await fetch('https://api.hubapi.com/crm/v3/owners?limit=200', {
    headers: { Authorization: `Bearer ${pat}` },
    cache: 'no-store',
  })
  if (!resp.ok) return {}
  const data = await resp.json() as {
    results?: Array<{ id: string; firstName?: string; lastName?: string; email?: string }>
  }
  const map: Record<string, string> = {}
  for (const o of data.results ?? []) {
    const name = [o.firstName, o.lastName].filter(Boolean).join(' ').trim() || o.email || o.id
    map[o.id] = name
  }
  return map
}

export interface MeetingStatus {
  scheduled: boolean  // tem ≥1 reunião associada (qualquer outcome)
  completed: boolean  // tem ≥1 reunião com outcome COMPLETED
}

async function fetchMeetingStatusByDeal(pat: string, dealIds: string[]): Promise<Map<string, MeetingStatus>> {
  const status = new Map<string, MeetingStatus>()
  if (dealIds.length === 0) return status

  const CHUNK = 100

  for (let i = 0; i < dealIds.length; i += CHUNK) {
    const chunk = dealIds.slice(i, i + CHUNK)

    // Step 1: get meeting IDs associated with each deal
    const assocResp = await fetch('https://api.hubapi.com/crm/v4/associations/deals/meetings/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
    })
    if (!assocResp.ok) continue

    const assocData = await assocResp.json() as {
      results?: Array<{ from: { id: string }; to: Array<{ toObjectId: string }> }>
    }

    const dealByMeeting: Record<string, string> = {}
    const meetingIds: string[] = []
    for (const row of assocData.results ?? []) {
      // qualquer reunião associada = agendada
      status.set(row.from.id, { scheduled: true, completed: status.get(row.from.id)?.completed ?? false })
      for (const t of row.to ?? []) {
        dealByMeeting[t.toObjectId] = row.from.id
        meetingIds.push(t.toObjectId)
      }
    }
    if (meetingIds.length === 0) continue

    // Step 2: batch read meeting outcomes → marca realizadas
    const meetResp = await fetch('https://api.hubapi.com/crm/v3/objects/meetings/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: meetingIds.map((id) => ({ id })),
        properties: ['hs_meeting_outcome'],
      }),
    })
    if (!meetResp.ok) continue

    const meetData = await meetResp.json() as {
      results?: Array<{ id: string; properties: { hs_meeting_outcome?: string } }>
    }
    for (const m of meetData.results ?? []) {
      if (m.properties.hs_meeting_outcome === 'COMPLETED') {
        const dealId = dealByMeeting[m.id]
        if (dealId) status.set(dealId, { scheduled: true, completed: true })
      }
    }
  }

  return status
}

async function fetchCompanyIdByDeal(pat: string, dealIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (dealIds.length === 0) return map

  const CHUNK = 100

  for (let i = 0; i < dealIds.length; i += CHUNK) {
    const chunk = dealIds.slice(i, i + CHUNK)

    const resp = await fetch('https://api.hubapi.com/crm/v4/associations/deals/companies/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
    })
    if (!resp.ok) continue

    const data = await resp.json() as {
      results?: Array<{
        from: { id: string }
        to: Array<{ toObjectId: number | string; associationTypes?: Array<{ label?: string | null }> }>
      }>
    }

    for (const row of data.results ?? []) {
      const tos = row.to ?? []
      if (tos.length === 0) continue
      // prefere a associação "Primary"; senão pega a primeira
      const primary = tos.find((t) => t.associationTypes?.some((a) => a.label === 'Primary')) ?? tos[0]
      map.set(row.from.id, String(primary.toObjectId))
    }
  }

  return map
}

export async function fetchAllDeals(): Promise<FetchResult> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT environment variable is not set')

  const [farmerIds, ownerMap] = await Promise.all([
    Promise.resolve(Object.keys(FARMERS)),
    fetchOwnerMap(pat),
  ])
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
              value: '1767225600000', // 2026-01-01
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
        'createdate',
        'hs_lastmodifieddate',
        'dealstage',
        'conseguiu_agendar_a_meet_',
        'hubspot_owner_id',
        'origem_do_lead',
        'origem_da_qualificacao',
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
      const rawFarmerId = props.sdrfarmer_responsavel ?? ''
      const farmerId = FARMER_ALIASES[rawFarmerId] ?? rawFarmerId
      const rawDate = props.pipedrive___data_de_qualificacao ?? ''
      // HubSpot retorna "YYYY-MM-DD" ou ms timestamp.
      // Armazenamos ao meio-dia UTC (T12:00:00Z) para que o browser
      // em qualquer timezone (incluindo BRT UTC-3) exiba o dia correto.
      let dateIso = ''
      if (rawDate) {
        if (/^\d{10,}$/.test(rawDate)) {
          // ms timestamp → extrair YYYY-MM-DD e fixar ao meio-dia UTC
          const d = new Date(parseInt(rawDate, 10))
          const ymd = d.toISOString().slice(0, 10)
          dateIso = `${ymd}T12:00:00.000Z`
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          // string de data — fixar ao meio-dia UTC diretamente
          dateIso = `${rawDate}T12:00:00.000Z`
        } else {
          dateIso = new Date(rawDate).toISOString()
        }
      }

      rawDeals.push({
        id: deal.id,
        name: props.dealname ?? `Deal ${deal.id}`,
        farmerId,
        farmerName: FARMERS[farmerId] ?? farmerId,
        score: parseFloat(props.pontuacao_leadscore ?? '0') || 0,
        criteria: matchCriteria(props.criterios_atendidos),
        date: dateIso,
        hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${deal.id}`,
        pipeline: props.pipeline ?? '',
        closedLostReason: props.closed_lost_reason ?? '',
        createDate: props.createdate ? new Date(props.createdate).toISOString() : '',
        lastModifiedDate: props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate).toISOString() : '',
        dealStage: props.dealstage ?? '',
        meetingScheduled: false,  // preenchido via fetchMeetingStatusByDeal
        meetingCompleted: false,  // preenchido via fetchMeetingStatusByDeal
        ownerName: ownerMap[props.hubspot_owner_id ?? ''] ?? '',
        isScored: !!props.pontuacao_leadscore,
        companyId: '',            // preenchido via fetchCompanyIdByDeal
        origemDoLead: props.origem_do_lead ?? '',
        origemQualificacao: props.origem_da_qualificacao ?? '',
        ownerId: props.hubspot_owner_id ?? '',
      })
    }

    const nextAfter = data.paging?.next?.after
    if (!nextAfter) break
    after = nextAfter
  }

  // Apply per-farmer date restrictions (fromDate / untilDate)
  const originCutover = new Date(ORIGIN_CUTOVER).getTime()
  const restrictedRaw = rawDeals.filter((d) => {
    const restriction = FARMER_DATE_RESTRICTIONS[d.farmerId]
    if (d.date && restriction) {
      const ts = new Date(d.date).getTime()
      if (restriction.fromDate && ts < new Date(restriction.fromDate).getTime()) return false
      if (restriction.untilDate && ts >= new Date(restriction.untilDate).getTime()) return false
    }
    // Filtro de origem: vale só de ORIGIN_CUTOVER (jul/26) em diante.
    // Histórico mantém todas as origens.
    if (d.date && new Date(d.date).getTime() >= originCutover) {
      const okLead = ALLOWED_ORIGEM_DO_LEAD.includes(d.origemDoLead)
      const okQual = ALLOWED_ORIGEM_QUALIFICACAO.includes(d.origemQualificacao)
      if (!okLead && !okQual) return false
    }
    return true
  })
  rawDeals.length = 0
  restrictedRaw.forEach((d) => rawDeals.push(d))

  // Busca reuniões reais e empresa associada para TODOS os negócios (em paralelo)
  const allDealIds = rawDeals.map((d) => d.id)
  const [meetingStatus, companyByDeal] = await Promise.all([
    fetchMeetingStatusByDeal(pat, allDealIds),
    fetchCompanyIdByDeal(pat, allDealIds),
  ])
  for (const d of rawDeals) {
    const ms = meetingStatus.get(d.id)
    if (ms) {
      d.meetingScheduled = ms.scheduled
      d.meetingCompleted = ms.completed
    }
    d.companyId = companyByDeal.get(d.id) ?? ''
  }

  const totalBruto = rawDeals.length
  const excluded = rawDeals.filter((d) => isForaDoMOA(d.closedLostReason))
  const excludedFora = excluded.length
  const deals = rawDeals.filter((d) => !isForaDoMOA(d.closedLostReason))

  const excludedDeals: ExcludedDeal[] = excluded.map((d) => ({
    id: d.id,
    name: d.name,
    farmerId: d.farmerId,
    farmerName: d.farmerName,
    date: d.date,
    hubspotUrl: d.hubspotUrl,
  }))

  // Group excluded deals by farmer (global, unfiltered — used as fallback)
  const foraByFarmer: Record<string, number> = {}
  for (const d of excluded) {
    foraByFarmer[d.farmerName] = (foraByFarmer[d.farmerName] ?? 0) + 1
  }
  const foraDoMOA = Object.entries(foraByFarmer)
    .map(([farmerName, count]) => ({ farmerName, count }))
    .sort((a, b) => b.count - a.count)

  return {
    deals,
    validation: { totalBruto, excludedFora, totalLiquido: deals.length },
    foraDoMOA,
    excludedDeals,
  }
}
