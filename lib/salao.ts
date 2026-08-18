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
  '95810969': { name: 'Rhayssa', initials: 'RH' },
  '96589066': { name: 'Nathalia', initials: 'NA' },
  '95415669': { name: 'Gisele', initials: 'GI' },
  '95993082': { name: 'Hans Lopes', initials: 'HL' },
  '97204561': { name: 'Juliano', initials: 'JM' },
  '97204635': { name: 'Samuel', initials: 'SO' },
  '84249251': { name: 'Tércio', initials: 'TE' },
  '85002282': { name: 'Sotoriva', initials: 'FS' },
  '85846971': { name: 'Francielle Teles', initials: 'FT' },
  '93599591': { name: 'Bruna Saraiva', initials: 'BS' },
  '92335488': { name: 'Thainá', initials: 'TH' },
  '94316537': { name: 'Maria Julia', initials: 'MJ' },
  '80688884': { name: 'Rafael Brack', initials: 'RB' },
  '80228367': { name: 'Julhy', initials: 'JU' },
  '84497577': { name: 'Vitória', initials: 'VI' },
  '81033487': { name: 'Gustavo Pacheco', initials: 'GP' },
  '82410958': { name: 'Maria Eduarda', initials: 'ME' },
  '79760745': { name: 'Thiago Souza', initials: 'TS' },
  '87159365': { name: 'João Backmann', initials: 'JB' },
  '85002012': { name: 'Bruna Machado', initials: 'BM' },
  '94028856': { name: 'Andrei Felippe', initials: 'AF' },
  '96198720': { name: 'Alecxia', initials: 'AX' },
}

const ALIAS_MAP: Record<string, string> = { '93238814': '85002282' }
const CANONICAL_IDS = Object.keys(ALL_FARMERS)
const ALL_SEARCH_IDS = [...CANONICAL_IDS, ...Object.keys(ALIAS_MAP)]
const WON_STAGES = ['1076664462', '1076664460']

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
    { propertyName: 'createdate', operator: 'GTE', value: startMs },
    { propertyName: 'createdate', operator: 'LT', value: endMs },
    { propertyName: 'pipeline', operator: 'EQ', value: 'default' },
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

  const [dealsRes, wonRes, meetingsRes, connectedDisps, emailsRes, tasksRes] = await Promise.all([
    searchAllPages(pat, 'deals', [{ filters: dealFilters }], ['sdrfarmer_responsavel']).catch(() => []),
    searchAllPages(pat, 'deals', [{ filters: wonFilters }], ['sdrfarmer_responsavel', 'amount_in_home_currency']).catch(() => []),
    searchAllPages(pat, 'meetings', [{ filters: engFilters }], ['hubspot_owner_id', 'hs_meeting_outcome']).catch(() => []),
    getConnectedDispositions(pat),
    searchAllPages(pat, 'emails', [{ filters: engFilters }], ['hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'tasks', [{ filters: engFilters }], ['hubspot_owner_id']).catch(() => []),
  ])

  const callsRes = await searchAllPages(pat, 'calls', [{ filters: engFilters }], ['hubspot_owner_id', 'hs_call_disposition']).catch(() => [])

  const dealCounts = new Map<string, number>()
  for (const r of dealsRes) {
    const fid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
    if (ALL_FARMERS[fid]) dealCounts.set(fid, (dealCounts.get(fid) ?? 0) + 1)
  }

  const wonValues = new Map<string, number>()
  for (const r of wonRes) {
    const fid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
    if (!ALL_FARMERS[fid]) continue
    const amount = parseFloat(r.properties.amount_in_home_currency ?? '0') || 0
    wonValues.set(fid, (wonValues.get(fid) ?? 0) + amount)
  }

  const mtgMap = new Map<string, { held: number; scheduled: number }>()
  for (const r of meetingsRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (!ALL_FARMERS[fid]) continue
    const cur = mtgMap.get(fid) ?? { held: 0, scheduled: 0 }
    cur.scheduled++
    if (r.properties.hs_meeting_outcome === 'COMPLETED') cur.held++
    mtgMap.set(fid, cur)
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
      deals: dealCounts.get(id) ?? 0,
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
