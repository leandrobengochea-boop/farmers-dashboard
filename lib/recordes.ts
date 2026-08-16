export interface RecordPodiumEntry {
  farmerId: string
  name: string
  initials: string
  value: number
  month: string
}

export interface MetricRecord {
  key: string
  label: string
  podium: RecordPodiumEntry[]
}

export interface MonthlyBestEntry {
  farmerId: string
  name: string
  initials: string
  value: number
}

export interface MonthlyRow {
  month: string
  label: string
  bests: Record<string, MonthlyBestEntry | null>
}

export interface RecordesData {
  records: MetricRecord[]
  monthly: MonthlyRow[]
  updatedAt: string
  year: number
}

const HALL_FARMERS: Record<string, { name: string; initials: string }> = {
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
const CANONICAL_IDS = Object.keys(HALL_FARMERS)
const ALL_SEARCH_IDS = [...CANONICAL_IDS, ...Object.keys(ALIAS_MAP)]
const WON_STAGES = ['1076664462', '1076664460']

const MONTHS_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

const METRIC_DEFS = [
  { key: 'deals', label: 'Negócios criados' },
  { key: 'valor', label: 'Valor fechado' },
  { key: 'meetingsHeld', label: 'Reuniões realizadas' },
  { key: 'meetingsScheduled', label: 'Reuniões agendadas' },
  { key: 'effectiveContacts', label: 'Contatos efetivos' },
  { key: 'contactAttempts', label: 'Tentativas de contato' },
] as const

type MetricKey = (typeof METRIC_DEFS)[number]['key']

interface FarmerMonth {
  deals: number
  valor: number
  meetingsHeld: number
  meetingsScheduled: number
  effectiveContacts: number
  contactAttempts: number
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

function getMonthRanges(year: number): Array<{ month: string; startMs: string; endMs: string; label: string }> {
  const now = new Date()
  const maxMonth = now.getFullYear() === year ? now.getMonth() : 11
  const ranges = []
  for (let m = 0; m <= maxMonth; m++) {
    const start = new Date(year, m, 1)
    const end = new Date(year, m + 1, 1)
    const mm = String(m + 1).padStart(2, '0')
    ranges.push({
      month: `${year}-${mm}`,
      startMs: start.getTime().toString(),
      endMs: end.getTime().toString(),
      label: MONTHS_PT[mm] ?? mm,
    })
  }
  return ranges
}

function countByFarmer(
  results: Array<{ id: string; properties: Record<string, string | null> }>,
  field: string,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of results) {
    const raw = r.properties[field] ?? ''
    const fid = resolveId(raw)
    if (HALL_FARMERS[fid]) counts.set(fid, (counts.get(fid) ?? 0) + 1)
  }
  return counts
}

async function fetchMonthMetrics(
  pat: string,
  startMs: string,
  endMs: string,
  connectedDisps: Set<string>,
): Promise<Map<string, FarmerMonth>> {
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
  const engFilters = (prop: string) => [
    { propertyName: prop, operator: 'IN', values: ALL_SEARCH_IDS },
    { propertyName: 'hs_timestamp', operator: 'GTE', value: startMs },
    { propertyName: 'hs_timestamp', operator: 'LT', value: endMs },
  ]

  const [dealsRes, wonRes, meetingsRes, callsRes, emailsRes, tasksRes] = await Promise.all([
    searchAllPages(pat, 'deals', [{ filters: dealFilters }], ['sdrfarmer_responsavel']).catch(() => []),
    searchAllPages(pat, 'deals', [{ filters: wonFilters }], ['sdrfarmer_responsavel', 'amount_in_home_currency']).catch(() => []),
    searchAllPages(pat, 'meetings', [{ filters: engFilters('hubspot_owner_id') }], ['hubspot_owner_id', 'hs_meeting_outcome']).catch(() => []),
    searchAllPages(pat, 'calls', [{ filters: engFilters('hubspot_owner_id') }], ['hubspot_owner_id', 'hs_call_disposition']).catch(() => []),
    searchAllPages(pat, 'emails', [{ filters: engFilters('hubspot_owner_id') }], ['hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'tasks', [{ filters: engFilters('hubspot_owner_id') }], ['hubspot_owner_id']).catch(() => []),
  ])

  const dealCounts = countByFarmer(dealsRes, 'sdrfarmer_responsavel')

  const wonValues = new Map<string, number>()
  for (const r of wonRes) {
    const fid = resolveId(r.properties.sdrfarmer_responsavel ?? '')
    if (!HALL_FARMERS[fid]) continue
    const amount = parseFloat(r.properties.amount_in_home_currency ?? '0') || 0
    wonValues.set(fid, (wonValues.get(fid) ?? 0) + amount)
  }

  const mtgMap = new Map<string, { held: number; scheduled: number }>()
  for (const r of meetingsRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (!HALL_FARMERS[fid]) continue
    const cur = mtgMap.get(fid) ?? { held: 0, scheduled: 0 }
    cur.scheduled++
    if (r.properties.hs_meeting_outcome === 'COMPLETED') cur.held++
    mtgMap.set(fid, cur)
  }

  const callMap = new Map<string, { connected: number; total: number }>()
  for (const r of callsRes) {
    const fid = resolveId(r.properties.hubspot_owner_id ?? '')
    if (!HALL_FARMERS[fid]) continue
    const cur = callMap.get(fid) ?? { connected: 0, total: 0 }
    cur.total++
    if (r.properties.hs_call_disposition && connectedDisps.has(r.properties.hs_call_disposition)) cur.connected++
    callMap.set(fid, cur)
  }

  const emailCounts = countByFarmer(emailsRes, 'hubspot_owner_id')
  const taskCounts = countByFarmer(tasksRes, 'hubspot_owner_id')

  const result = new Map<string, FarmerMonth>()
  for (const id of CANONICAL_IDS) {
    const mtg = mtgMap.get(id)
    const call = callMap.get(id)
    result.set(id, {
      deals: dealCounts.get(id) ?? 0,
      valor: Math.round(wonValues.get(id) ?? 0),
      meetingsHeld: mtg?.held ?? 0,
      meetingsScheduled: mtg?.scheduled ?? 0,
      effectiveContacts: call?.connected ?? 0,
      contactAttempts: (call?.total ?? 0) + (emailCounts.get(id) ?? 0) + (taskCounts.get(id) ?? 0),
    })
  }
  return result
}

let cache: { data: RecordesData; expires: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

export async function fetchRecordesData(forceRefresh = false): Promise<RecordesData> {
  if (!forceRefresh && cache && Date.now() < cache.expires) {
    return cache.data
  }

  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT not set')

  const year = new Date().getFullYear()
  const months = getMonthRanges(year)
  const connectedDisps = await getConnectedDispositions(pat)

  // best-ever per farmer per metric (for podium: top 3 unique farmers)
  const farmerBests = new Map<string, Map<MetricKey, { value: number; month: string }>>()
  for (const id of CANONICAL_IDS) {
    const m = new Map<MetricKey, { value: number; month: string }>()
    for (const def of METRIC_DEFS) m.set(def.key, { value: 0, month: '' })
    farmerBests.set(id, m)
  }

  // monthly bests (best farmer per metric per month)
  const monthlyRows: MonthlyRow[] = []

  // Process 2 months at a time to control concurrency
  for (let i = 0; i < months.length; i += 2) {
    const batch = months.slice(i, i + 2)
    const results = await Promise.all(
      batch.map((m) =>
        fetchMonthMetrics(pat, m.startMs, m.endMs, connectedDisps)
          .then((data) => ({ month: m.month, label: m.label, data }))
          .catch(() => ({ month: m.month, label: m.label, data: new Map<string, FarmerMonth>() })),
      ),
    )

    for (const { month, label, data } of results) {
      const bests: Record<string, MonthlyBestEntry | null> = {}
      for (const def of METRIC_DEFS) bests[def.key] = null

      for (const [fid, metrics] of data) {
        const info = HALL_FARMERS[fid]
        if (!info) continue

        for (const def of METRIC_DEFS) {
          const val = metrics[def.key]
          if (val <= 0) continue

          // Update farmer best
          const fb = farmerBests.get(fid)!.get(def.key)!
          if (val > fb.value) {
            fb.value = val
            fb.month = month
          }

          // Update monthly best
          const cur = bests[def.key]
          if (!cur || val > cur.value) {
            bests[def.key] = { farmerId: fid, name: info.name, initials: info.initials, value: val }
          }
        }
      }

      monthlyRows.push({ month, label, bests })
    }
  }

  // Build podiums: for each metric, rank farmers by their personal best, take top 3
  const records: MetricRecord[] = METRIC_DEFS.map((def) => {
    const entries: RecordPodiumEntry[] = []
    for (const [fid, bestsMap] of farmerBests) {
      const best = bestsMap.get(def.key)!
      if (best.value > 0) {
        const info = HALL_FARMERS[fid]
        entries.push({ farmerId: fid, name: info.name, initials: info.initials, value: best.value, month: best.month })
      }
    }
    entries.sort((a, b) => b.value - a.value)
    return { key: def.key, label: def.label, podium: entries.slice(0, 3) }
  })

  const data: RecordesData = {
    records,
    monthly: monthlyRows,
    updatedAt: new Date().toISOString(),
    year,
  }

  cache = { data, expires: Date.now() + CACHE_TTL }
  return data
}
