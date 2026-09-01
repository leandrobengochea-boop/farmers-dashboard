export interface SalaoFarmerData {
  ownerId: string
  name: string
  initials: string
  deals: number
  valor: number
  meetingsHeld: number
  meetingsScheduled: number
  effectiveContacts: number
  contactAttempts: number
  rank: number
}

export interface SalaoData {
  farmers: SalaoFarmerData[]
  month: string
  updatedAt: string
  daysLeft: number
}

const ALL_FARMERS: Record<string, { name: string; initials: string }> = {
  '89632472': { name: 'Maria Eduarda Porto', initials: 'MP' },
  '85002282': { name: 'Sotoriva', initials: 'FS' },
  '79760745': { name: 'Thiago Souza', initials: 'TS' },
  '85846971': { name: 'Francielle Lenz', initials: 'FL' },
  '84497577': { name: 'Vitória', initials: 'VI' },
  '80228367': { name: 'Jhuly', initials: 'JU' },
  '95810969': { name: 'Rhayssa', initials: 'RH' },
  '93599591': { name: 'Bruna Saraiva', initials: 'BS' },
  '87159365': { name: 'João Backmann', initials: 'JB' },
  '95993082': { name: 'Hans Lopes', initials: 'HL' },
  '85002012': { name: 'Bruna Machado', initials: 'BM' },
  '94316537': { name: 'Maria Julia', initials: 'MJ' },
  '95415669': { name: 'Gisele', initials: 'GI' },
  '94028856': { name: 'Milei', initials: 'MI' },
  '88200239': { name: 'Luiza', initials: 'LU' },
  '97763591': { name: 'Leonardo Bitencourt', initials: 'LB' },
  '81033487': { name: 'Gustavo Pacheco', initials: 'GP' },
  '94891358': { name: 'Priscila', initials: 'PR' },
  '92335488': { name: 'Thaina', initials: 'TH' },
  '80688884': { name: 'Rafael Brack', initials: 'RB' },
  '96589066': { name: 'Nathalia', initials: 'NA' },
  '97204561': { name: 'Juliano', initials: 'JM' },
  '97204635': { name: 'Samuel', initials: 'SO' },
}

const SALAO_DATE_RESTRICTIONS: Record<string, { untilDate: string }> = {
}

const ALIAS_MAP: Record<string, string> = { '93238814': '85002282' }
const CANONICAL_IDS = Object.keys(ALL_FARMERS)
const ALL_SEARCH_IDS = [...CANONICAL_IDS, ...Object.keys(ALIAS_MAP)]
const WON_STAGES = ['1076664462', '1076664460']

const B2C_PIPELINE_IDS = new Set(['725182862', '727938450', '904543067'])

const ORIGIN_CUTOVER_MS = new Date('2026-07-01').getTime()
const ALLOWED_ORIGEM_DO_LEAD = ['Ação de CRM', 'Ação de CRM (Carteira)', 'Carteira do Farmer', 'CARTEIRA (Executivos em foco)']
const ALLOWED_ORIGEM_QUALIFICACAO = ['Farmer']
const ORIGIN_OVERRIDE_DEAL_IDS = new Set(['62654660376', '63187333523'])

function uniqueDemandKey(deal: { id: string; pipeline: string; companyId: string; farmerId?: string }): string {
  const prefix = deal.farmerId ? `${deal.farmerId}:` : ''
  if (B2C_PIPELINE_IDS.has(deal.pipeline)) return `${prefix}deal:${deal.id}`
  return `${prefix}${deal.companyId || `deal:${deal.id}`}`
}

function normalizeForMOA(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_')
}

function isForaDoMOA(closedLostReason: string, motivoPerda: string): boolean {
  for (const v of [closedLostReason, motivoPerda]) {
    if (!v) continue
    const n = normalizeForMOA(v)
    if (n.includes('fora') && n.includes('moa')) return true
  }
  return false
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function resolveId(id: string): string {
  return ALIAS_MAP[id] ?? id
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, init)
    if (resp.status === 429) {
      const ra = resp.headers.get('retry-after')
      const wait = ra ? Math.max(parseInt(ra, 10) * 1000, 200) : 200 * Math.pow(2, attempt)
      await sleep(wait)
      continue
    }
    return resp
  }
  return fetch(url, init)
}

async function searchAllPages(
  pat: string,
  objectType: string,
  filterGroups: Record<string, unknown>[],
  properties: string[],
): Promise<Array<{ id: string; properties: Record<string, string | null> }>> {
  const results: Array<{ id: string; properties: Record<string, string | null> }> = []
  let after: string | undefined
  while (true) {
    if (after) await sleep(150)
    const body: Record<string, unknown> = { filterGroups, properties, limit: 200 }
    if (after) body.after = after
    const resp = await fetchWithRetry(
      `https://api.hubapi.com/crm/v3/objects/${objectType}/search`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    )
    if (!resp.ok) break
    const data = (await resp.json()) as {
      results?: Array<{ id: string; properties: Record<string, string | null> }>
      paging?: { next?: { after?: string } }
    }
    results.push(...(data.results ?? []))
    after = data.paging?.next?.after
    if (!after) break
  }
  return results
}

async function getConnectedDispositions(pat: string): Promise<Set<string>> {
  try {
    const resp = await fetchWithRetry(
      'https://api.hubapi.com/calling/v1/dispositions',
      { headers: { Authorization: `Bearer ${pat}` }, cache: 'no-store' },
    )
    if (!resp.ok) return new Set()
    const data = (await resp.json()) as Array<{ id: string; label: string; deleted: boolean }>
    return new Set(
      data
        .filter((o) => {
          if (o.deleted) return false
          const l = o.label.toLowerCase()
          return l.includes('conect') || l.includes('connect') || l.includes('atend')
        })
        .map((o) => o.id),
    )
  } catch {
    return new Set()
  }
}

async function batchReadCompanyAssociations(
  pat: string,
  dealIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (let i = 0; i < dealIds.length; i += 500) {
    const batch = dealIds.slice(i, i + 500)
    if (i > 0) await sleep(150)
    const resp = await fetchWithRetry(
      'https://api.hubapi.com/crm/v4/associations/deals/companies/batch/read',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: batch.map((id) => ({ id })) }),
        cache: 'no-store',
      },
    )
    if (!resp.ok) continue
    const data = (await resp.json()) as {
      results?: Array<{
        from: { id: string }
        to: Array<{ toObjectId: string }>
      }>
    }
    for (const item of data.results ?? []) {
      const dealId = item.from?.id
      const companyId = item.to?.[0]?.toObjectId
      if (dealId && companyId) result.set(String(dealId), String(companyId))
    }
  }
  return result
}

async function fetchDealMeetingStatus(
  pat: string,
  dealIds: string[],
): Promise<Map<string, { scheduled: boolean; completed: boolean }>> {
  const status = new Map<string, { scheduled: boolean; completed: boolean }>()
  if (dealIds.length === 0) return status

  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100)
    if (i > 0) await sleep(150)
    const assocResp = await fetchWithRetry(
      'https://api.hubapi.com/crm/v4/associations/deals/meetings/batch/read',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
        cache: 'no-store',
      },
    )
    if (!assocResp.ok) continue

    const assocData = (await assocResp.json()) as {
      results?: Array<{ from: { id: string }; to: Array<{ toObjectId: string | number }> }>
    }
    const dealByMeeting: Record<string, string> = {}
    const meetingIds: string[] = []
    for (const row of assocData.results ?? []) {
      status.set(row.from.id, { scheduled: true, completed: status.get(row.from.id)?.completed ?? false })
      for (const t of row.to ?? []) {
        const mid = String(t.toObjectId)
        dealByMeeting[mid] = row.from.id
        meetingIds.push(mid)
      }
    }
    if (meetingIds.length === 0) continue

    const meetResp = await fetchWithRetry(
      'https://api.hubapi.com/crm/v3/objects/meetings/batch/read',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: meetingIds.map((id) => ({ id })), properties: ['hs_meeting_outcome'] }),
        cache: 'no-store',
      },
    )
    if (!meetResp.ok) continue

    const meetData = (await meetResp.json()) as {
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

function monthBounds(): { startMs: string; endMs: string; monthLabel: string; daysLeft: number } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 1)
  const lastDay = new Date(y, m + 1, 0).getDate()
  const daysLeft = Math.max(0, lastDay - now.getDate())
  const monthLabel = `${y}-${String(m + 1).padStart(2, '0')}`
  return { startMs: start.getTime().toString(), endMs: end.getTime().toString(), monthLabel, daysLeft }
}

function olympicSort(a: SalaoFarmerData, b: SalaoFarmerData): number {
  const keys: (keyof SalaoFarmerData)[] = [
    'deals', 'meetingsHeld', 'meetingsScheduled', 'effectiveContacts', 'contactAttempts',
  ]
  for (const k of keys) {
    const diff = (b[k] as number) - (a[k] as number)
    if (diff !== 0) return diff
  }
  return a.name.localeCompare(b.name)
}

function assignRanks(sorted: SalaoFarmerData[]): void {
  const keys: (keyof SalaoFarmerData)[] = [
    'deals', 'meetingsHeld', 'meetingsScheduled', 'effectiveContacts', 'contactAttempts',
  ]
  sorted.forEach((f, i) => {
    if (i === 0) { f.rank = 1; return }
    const prev = sorted[i - 1]
    const tied = keys.every((k) => f[k] === prev[k])
    f.rank = tied ? prev.rank : i + 1
  })
}

export async function fetchSalaoData(): Promise<SalaoData> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT not set')

  const { startMs, endMs, monthLabel, daysLeft } = monthBounds()

  const dealFilters = [
    { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: ALL_SEARCH_IDS },
    { propertyName: 'pipedrive___data_de_qualificacao', operator: 'GTE', value: startMs },
    { propertyName: 'pipedrive___data_de_qualificacao', operator: 'LT', value: endMs },
  ]
  const wonFilters = [
    { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: ALL_SEARCH_IDS },
    { propertyName: 'closedate', operator: 'GTE', value: startMs },
    { propertyName: 'closedate', operator: 'LT', value: endMs },
    { propertyName: 'dealstage', operator: 'IN', values: WON_STAGES },
  ]
  const engFilters = [
    { propertyName: 'hubspot_owner_id', operator: 'IN', values: ALL_SEARCH_IDS },
    { propertyName: 'hs_timestamp', operator: 'GTE', value: startMs },
    { propertyName: 'hs_timestamp', operator: 'LT', value: endMs },
  ]

  const [dealsRes, wonRes, connectedDisps, emailsRes, tasksRes] = await Promise.all([
    searchAllPages(pat, 'deals', [{ filters: dealFilters }], [
      'sdrfarmer_responsavel', 'pipeline', 'origem_do_lead', 'origem_da_qualificacao',
      'closed_lost_reason', 'motivo_de_sinalizacao_de_perda', 'pipedrive___data_de_qualificacao',
    ]).catch(() => []),
    searchAllPages(pat, 'deals', [{ filters: wonFilters }], ['sdrfarmer_responsavel', 'amount_in_home_currency']).catch(() => []),
    getConnectedDispositions(pat),
    searchAllPages(pat, 'emails', [{ filters: engFilters }], ['hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'tasks', [{ filters: engFilters }], ['hubspot_owner_id']).catch(() => []),
  ])

  const callsRes = await searchAllPages(pat, 'calls', [{ filters: engFilters }], ['hubspot_owner_id', 'hs_call_disposition']).catch(() => [])

  // Apply origin filter (post-cutover) and "Fora do MOA" exclusion
  const filteredDeals = dealsRes.filter((r) => {
    if (isForaDoMOA(r.properties.closed_lost_reason ?? '', r.properties.motivo_de_sinalizacao_de_perda ?? '')) return false
    if (!ORIGIN_OVERRIDE_DEAL_IDS.has(r.id)) {
      const okLead = ALLOWED_ORIGEM_DO_LEAD.includes(r.properties.origem_do_lead ?? '')
      const okQual = ALLOWED_ORIGEM_QUALIFICACAO.includes(r.properties.origem_da_qualificacao ?? '')
      if (!okLead && !okQual) return false
    }
    const fid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
    const restriction = SALAO_DATE_RESTRICTIONS[fid]
    if (restriction?.untilDate) {
      const raw = r.properties.pipedrive___data_de_qualificacao ?? ''
      const qualMs = /^\d{10,}$/.test(raw) ? parseInt(raw, 10) : new Date(raw).getTime()
      if (qualMs >= new Date(restriction.untilDate).getTime()) return false
    }
    return true
  })

  // Fetch company associations and meeting status per deal in parallel
  const dealIdsAll = filteredDeals.map((r) => r.id)
  const [companyMap, dealMeetingStatus] = await Promise.all([
    batchReadCompanyAssociations(pat, dealIdsAll),
    fetchDealMeetingStatus(pat, dealIdsAll),
  ])

  const uniqueCompanyCounts = new Map<string, number>()
  for (const fid of CANONICAL_IDS) {
    const seen = new Set<string>()
    for (const r of filteredDeals) {
      const dealFid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
      if (dealFid !== fid) continue
      const key = uniqueDemandKey({
        id: r.id,
        pipeline: r.properties.pipeline ?? 'default',
        companyId: companyMap.get(r.id) ?? '',
        farmerId: fid,
      })
      seen.add(key)
    }
    uniqueCompanyCounts.set(fid, seen.size)
  }

  const wonValues = new Map<string, number>()
  for (const r of wonRes) {
    const fid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
    if (!ALL_FARMERS[fid]) continue
    const amount = parseFloat(r.properties.amount_in_home_currency ?? '0') || 0
    wonValues.set(fid, (wonValues.get(fid) ?? 0) + amount)
  }

  // Count meetings per empresa (matching main dashboard logic)
  const mtgMap = new Map<string, { held: number; scheduled: number }>()
  for (const fid of CANONICAL_IDS) {
    const scheduledCompanies = new Set<string>()
    const completedCompanies = new Set<string>()
    for (const r of filteredDeals) {
      const dealFid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
      if (dealFid !== fid) continue
      const ms = dealMeetingStatus.get(r.id)
      if (!ms) continue
      const key = uniqueDemandKey({
        id: r.id,
        pipeline: r.properties.pipeline ?? 'default',
        companyId: companyMap.get(r.id) ?? '',
        farmerId: fid,
      })
      if (ms.scheduled) scheduledCompanies.add(key)
      if (ms.completed) completedCompanies.add(key)
    }
    mtgMap.set(fid, { scheduled: scheduledCompanies.size, held: completedCompanies.size })
  }

  const callMap = new Map<string, { connected: number; total: number }>()
  for (const r of callsRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (!ALL_FARMERS[fid]) continue
    const cur = callMap.get(fid) ?? { connected: 0, total: 0 }
    cur.total++
    if (r.properties.hs_call_disposition && connectedDisps.has(r.properties.hs_call_disposition)) cur.connected++
    callMap.set(fid, cur)
  }

  const emailCounts = new Map<string, number>()
  for (const r of emailsRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (ALL_FARMERS[fid]) emailCounts.set(fid, (emailCounts.get(fid) ?? 0) + 1)
  }

  const taskCounts = new Map<string, number>()
  for (const r of tasksRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (ALL_FARMERS[fid]) taskCounts.set(fid, (taskCounts.get(fid) ?? 0) + 1)
  }

  const farmers: SalaoFarmerData[] = CANONICAL_IDS.map((id) => {
    const info = ALL_FARMERS[id]
    const mtg = mtgMap.get(id)
    const call = callMap.get(id)
    return {
      ownerId: id,
      name: info.name,
      initials: info.initials,
      deals: uniqueCompanyCounts.get(id) ?? 0,
      valor: Math.round(wonValues.get(id) ?? 0),
      meetingsHeld: mtg?.held ?? 0,
      meetingsScheduled: mtg?.scheduled ?? 0,
      effectiveContacts: call?.connected ?? 0,
      contactAttempts: (call?.total ?? 0) + (emailCounts.get(id) ?? 0) + (taskCounts.get(id) ?? 0),
      rank: 0,
    }
  })

  farmers.sort(olympicSort)
  assignRanks(farmers)

  return { farmers, month: monthLabel, updatedAt: new Date().toISOString(), daysLeft }
}
