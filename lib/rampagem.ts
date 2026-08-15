export interface RampagemFarmerData {
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

export interface RampagemData {
  farmers: RampagemFarmerData[]
  month: string
  updatedAt: string
  daysLeft: number
}

export const RAMPAGEM_FARMERS: Record<string, { name: string; initials: string }> = {
  '95810969': { name: 'Rhayssa', initials: 'RH' },
  '95993082': { name: 'Hans Kelton', initials: 'HK' },
  '95415669': { name: 'Gisele', initials: 'GI' },
  '96198720': { name: 'Alecxia', initials: 'AL' },
  '96198838': { name: 'Leonardo Gomes', initials: 'LG' },
  '96589066': { name: 'Nathalia', initials: 'NA' },
  '97204561': { name: 'Juliano Marques', initials: 'JM' },
  '97204635': { name: 'Samuel Oliveira', initials: 'SO' },
}

const WON_STAGES = ['1076664462', '1076664460']
const FARMER_IDS = Object.keys(RAMPAGEM_FARMERS)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url: string, init: RequestInit, retries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, init)
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('retry-after')
      const waitMs = retryAfter ? Math.max(parseInt(retryAfter, 10) * 1000, 200) : 200 * Math.pow(2, attempt)
      await sleep(waitMs)
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

async function fetchDealsCreated(
  pat: string,
  startMs: string,
  endMs: string,
): Promise<Map<string, number>> {
  const results = await searchAllPages(pat, 'deals', [
    {
      filters: [
        { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: FARMER_IDS },
        { propertyName: 'createdate', operator: 'GTE', value: startMs },
        { propertyName: 'createdate', operator: 'LT', value: endMs },
        { propertyName: 'pipeline', operator: 'EQ', value: 'default' },
      ],
    },
  ], ['sdrfarmer_responsavel'])

  const counts = new Map<string, number>()
  for (const r of results) {
    const fid = r.properties.sdrfarmer_responsavel ?? ''
    if (RAMPAGEM_FARMERS[fid]) counts.set(fid, (counts.get(fid) ?? 0) + 1)
  }
  return counts
}

async function fetchDealsWonValue(
  pat: string,
  startMs: string,
  endMs: string,
): Promise<Map<string, number>> {
  const results = await searchAllPages(pat, 'deals', [
    {
      filters: [
        { propertyName: 'sdrfarmer_responsavel', operator: 'IN', values: FARMER_IDS },
        { propertyName: 'closedate', operator: 'GTE', value: startMs },
        { propertyName: 'closedate', operator: 'LT', value: endMs },
        { propertyName: 'dealstage', operator: 'IN', values: WON_STAGES },
      ],
    },
  ], ['sdrfarmer_responsavel', 'amount_in_home_currency'])

  const sums = new Map<string, number>()
  for (const r of results) {
    const fid = r.properties.sdrfarmer_responsavel ?? ''
    if (!RAMPAGEM_FARMERS[fid]) continue
    const amount = parseFloat(r.properties.amount_in_home_currency ?? '0') || 0
    sums.set(fid, (sums.get(fid) ?? 0) + amount)
  }
  return sums
}

async function fetchMeetings(
  pat: string,
  startMs: string,
  endMs: string,
): Promise<Map<string, { held: number; scheduled: number }>> {
  const results = await searchAllPages(pat, 'meetings', [
    {
      filters: [
        { propertyName: 'hubspot_owner_id', operator: 'IN', values: FARMER_IDS },
        { propertyName: 'hs_timestamp', operator: 'GTE', value: startMs },
        { propertyName: 'hs_timestamp', operator: 'LT', value: endMs },
      ],
    },
  ], ['hubspot_owner_id', 'hs_meeting_outcome'])

  const map = new Map<string, { held: number; scheduled: number }>()
  for (const r of results) {
    const fid = r.properties.hubspot_owner_id ?? ''
    if (!RAMPAGEM_FARMERS[fid]) continue
    const cur = map.get(fid) ?? { held: 0, scheduled: 0 }
    cur.scheduled++
    if (r.properties.hs_meeting_outcome === 'COMPLETED') cur.held++
    map.set(fid, cur)
  }
  return map
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

async function fetchCalls(
  pat: string,
  startMs: string,
  endMs: string,
  connectedDisps: Set<string>,
): Promise<Map<string, { connected: number; total: number }>> {
  const results = await searchAllPages(pat, 'calls', [
    {
      filters: [
        { propertyName: 'hubspot_owner_id', operator: 'IN', values: FARMER_IDS },
        { propertyName: 'hs_timestamp', operator: 'GTE', value: startMs },
        { propertyName: 'hs_timestamp', operator: 'LT', value: endMs },
      ],
    },
  ], ['hubspot_owner_id', 'hs_call_disposition'])

  const map = new Map<string, { connected: number; total: number }>()
  for (const r of results) {
    const fid = r.properties.hubspot_owner_id ?? ''
    if (!RAMPAGEM_FARMERS[fid]) continue
    const cur = map.get(fid) ?? { connected: 0, total: 0 }
    cur.total++
    const disp = r.properties.hs_call_disposition
    if (disp && connectedDisps.has(disp)) cur.connected++
    map.set(fid, cur)
  }
  return map
}

async function fetchEngagementCount(
  pat: string,
  objectType: string,
  startMs: string,
  endMs: string,
): Promise<Map<string, number>> {
  const results = await searchAllPages(pat, objectType, [
    {
      filters: [
        { propertyName: 'hubspot_owner_id', operator: 'IN', values: FARMER_IDS },
        { propertyName: 'hs_timestamp', operator: 'GTE', value: startMs },
        { propertyName: 'hs_timestamp', operator: 'LT', value: endMs },
      ],
    },
  ], ['hubspot_owner_id'])

  const counts = new Map<string, number>()
  for (const r of results) {
    const fid = r.properties.hubspot_owner_id ?? ''
    if (RAMPAGEM_FARMERS[fid]) counts.set(fid, (counts.get(fid) ?? 0) + 1)
  }
  return counts
}

function olympicSort(a: RampagemFarmerData, b: RampagemFarmerData): number {
  const keys: (keyof RampagemFarmerData)[] = [
    'deals', 'meetingsHeld', 'meetingsScheduled', 'effectiveContacts', 'contactAttempts',
  ]
  for (const k of keys) {
    const diff = (b[k] as number) - (a[k] as number)
    if (diff !== 0) return diff
  }
  return a.name.localeCompare(b.name)
}

function assignRanks(sorted: RampagemFarmerData[]): void {
  const keys: (keyof RampagemFarmerData)[] = [
    'deals', 'meetingsHeld', 'meetingsScheduled', 'effectiveContacts', 'contactAttempts',
  ]
  sorted.forEach((f, i) => {
    if (i === 0) { f.rank = 1; return }
    const prev = sorted[i - 1]
    const tied = keys.every((k) => f[k] === prev[k])
    f.rank = tied ? prev.rank : i + 1
  })
}

export async function fetchRampagemData(): Promise<RampagemData> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT not set')

  const { startMs, endMs, monthLabel, daysLeft } = monthBounds()

  const [dealsCreated, dealsWon, meetings, connectedDisps, emailCounts, taskCounts] =
    await Promise.all([
      fetchDealsCreated(pat, startMs, endMs),
      fetchDealsWonValue(pat, startMs, endMs),
      fetchMeetings(pat, startMs, endMs).catch(() => new Map()),
      getConnectedDispositions(pat),
      fetchEngagementCount(pat, 'emails', startMs, endMs).catch(() => new Map()),
      fetchEngagementCount(pat, 'tasks', startMs, endMs).catch(() => new Map()),
    ])

  const calls = await fetchCalls(pat, startMs, endMs, connectedDisps).catch(
    () => new Map<string, { connected: number; total: number }>(),
  )

  const farmers: RampagemFarmerData[] = FARMER_IDS.map((id) => {
    const info = RAMPAGEM_FARMERS[id]
    const mtg = meetings.get(id)
    const call = calls.get(id)
    const emails = emailCounts.get(id) ?? 0
    const tasks = taskCounts.get(id) ?? 0
    return {
      ownerId: id,
      name: info.name,
      initials: info.initials,
      deals: dealsCreated.get(id) ?? 0,
      valor: Math.round(dealsWon.get(id) ?? 0),
      meetingsHeld: mtg?.held ?? 0,
      meetingsScheduled: mtg?.scheduled ?? 0,
      effectiveContacts: (call?.connected ?? 0),
      contactAttempts: (call?.total ?? 0) + emails + tasks,
      rank: 0,
    }
  })

  farmers.sort(olympicSort)
  assignRanks(farmers)

  return {
    farmers,
    month: monthLabel,
    updatedAt: new Date().toISOString(),
    daysLeft,
  }
}
