import { HUBSPOT_PORTAL_ID } from '../constants'
import { Bucket, COTA_DIARIA, COOLDOWN_DIAS, ABORDAGEM_PADRAO } from './constants'
import { ItemDiario, empresasEmCooldown } from './db'

export interface Empresa {
  id: string
  nome: string
  ultimaCompra: string | null    // YYYY-MM-DD
  ultimoContato: string | null   // YYYY-MM-DD (ultimo_contato_efetivo)
  cidade: string
  hubspotUrl: string
  bucket: Bucket | 'nutricao'
  diasDesdeCompra: number | null
  noFunil: boolean               // já tem negócio aberto com este farmer
}

export interface ResumoPool {
  carteira: number
  comHistorico: number
  porBucket: Record<string, number>
  emCooldown: number
  noFunil: number
  contatoEfetivoNoMes: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchWithRetry(url: string, init: RequestInit, retries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, init)
    if (resp.status === 429) {
      const ra = resp.headers.get('retry-after')
      await sleep(ra ? Math.max(parseInt(ra, 10) * 1000, 200) : 200 * Math.pow(2, attempt))
      continue
    }
    return resp
  }
  return fetch(url, init)
}

export async function searchAllPages(
  pat: string,
  objectType: string,
  filterGroups: Record<string, unknown>[],
  properties: string[],
): Promise<Array<{ id: string; properties: Record<string, string | null> }>> {
  const results: Array<{ id: string; properties: Record<string, string | null> }> = []
  let after: string | undefined
  while (true) {
    if (after) await sleep(120)
    const body: Record<string, unknown> = { filterGroups, properties, limit: 200 }
    if (after) body.after = after
    const resp = await fetchWithRetry(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!resp.ok) break
    const data = (await resp.json()) as {
      results?: Array<{ id: string; properties: Record<string, string | null> }>
      paging?: { next?: { after?: string } }
    }
    results.push(...(data.results ?? []))
    const next = data.paging?.next?.after
    if (!next) break
    after = next
  }
  return results
}

/** Data de hoje em São Paulo, como YYYY-MM-DD. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function menosMeses(isoDate: string, meses: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - meses)
  return d.toISOString().slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de}T12:00:00Z`).getTime()
  const b = new Date(`${ate}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * Classifica a empresa pelo tempo desde a última contratação.
 * A faixa de 3 a 8 meses ('nutricao') fica fora das sugestões de propósito.
 */
export function classifica(ultimaCompra: string | null, hoje: string): { bucket: Bucket | 'nutricao'; dias: number | null } {
  if (!ultimaCompra) return { bucket: 'primeiro_contato', dias: null }
  const dias = diasEntre(ultimaCompra, hoje)
  if (ultimaCompra > menosMeses(hoje, 3)) return { bucket: 'extra', dias }
  if (ultimaCompra <= menosMeses(hoje, 12)) return { bucket: 'reativacao', dias }
  if (ultimaCompra <= menosMeses(hoje, 8)) return { bucket: 'recompra', dias }
  return { bucket: 'nutricao', dias }
}

/** Empresas com negócio aberto deste farmer — já estão sendo trabalhadas. */
async function empresasNoFunil(pat: string, farmerId: string): Promise<Set<string>> {
  const deals = await searchAllPages(
    pat,
    'deals',
    [{ filters: [
      { propertyName: 'sdrfarmer_responsavel', operator: 'EQ', value: farmerId },
      { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' },
    ] }],
    ['dealname'],
  ).catch(() => [])

  const ids = deals.map((d) => d.id)
  const empresas = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    if (i > 0) await sleep(120)
    const resp = await fetchWithRetry('https://api.hubapi.com/crm/v4/associations/deals/companies/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
    })
    if (!resp.ok) {
      console.error('associações deals→companies falharam:', resp.status)
      continue
    }
    const data = (await resp.json()) as { results?: Array<{ to: Array<{ toObjectId: number | string }> }> }
    for (const row of data.results ?? []) {
      for (const t of row.to ?? []) empresas.add(String(t.toObjectId))
    }
  }
  return empresas
}

export async function fetchCarteira(farmerId: string, hoje: string): Promise<Empresa[]> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  const [rows, noFunil] = await Promise.all([
    searchAllPages(
      pat,
      'companies',
      [{ filters: [{ propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId }] }],
      ['name', 'data_da_ultima_compra', 'ultimo_contato_efetivo', 'city'],
    ),
    empresasNoFunil(pat, farmerId),
  ])

  return rows.map((r) => {
    const ultimaCompra = (r.properties.data_da_ultima_compra ?? '')?.slice(0, 10) || null
    const { bucket, dias } = classifica(ultimaCompra, hoje)
    return {
      id: r.id,
      nome: r.properties.name ?? `Empresa ${r.id}`,
      ultimaCompra,
      ultimoContato: (r.properties.ultimo_contato_efetivo ?? '')?.slice(0, 10) || null,
      cidade: r.properties.city ?? '',
      hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-2/${r.id}`,
      bucket,
      diasDesdeCompra: dias,
      noFunil: noFunil.has(r.id),
    }
  })
}

/**
 * Ordem de prioridade dentro de cada balde:
 * - recompra: mais perto de estourar os 12 meses primeiro (compra mais antiga na frente)
 * - reativação: a mais "morna" primeiro (compra mais recente na frente)
 * - extra / primeiro contato: sem contato efetivo há mais tempo na frente
 * Desempate sempre por quem está há mais tempo sem contato efetivo.
 */
function ordena(bucket: Bucket, a: Empresa, b: Empresa): number {
  if (bucket === 'recompra') {
    const d = (a.ultimaCompra ?? '').localeCompare(b.ultimaCompra ?? '')
    if (d !== 0) return d
  }
  if (bucket === 'reativacao' || bucket === 'extra') {
    const d = (b.ultimaCompra ?? '').localeCompare(a.ultimaCompra ?? '')
    if (d !== 0) return d
  }
  return (a.ultimoContato ?? '').localeCompare(b.ultimoContato ?? '')
}

export interface Sugestoes {
  itens: ItemDiario[]
  resumo: ResumoPool
}

/**
 * Monta a lista do dia seguindo o Pareto: 5 recompra + 15 reativação + 3 extras.
 * Se um balde seca, completa com o balde vizinho — e, em último caso, com
 * empresas sem histórico de contratação (primeiro contato).
 */
export async function montaSugestoes(farmerId: string, hoje: string): Promise<Sugestoes> {
  const carteira = await fetchCarteira(farmerId, hoje)
  const cooldown = await empresasEmCooldown(farmerId, COOLDOWN_DIAS, hoje)
  const inicioMes = `${hoje.slice(0, 7)}-01`

  const resumo: ResumoPool = {
    carteira: carteira.length,
    comHistorico: carteira.filter((e) => e.ultimaCompra).length,
    porBucket: {},
    emCooldown: carteira.filter((e) => cooldown.has(e.id)).length,
    noFunil: carteira.filter((e) => e.noFunil).length,
    contatoEfetivoNoMes: carteira.filter((e) => e.ultimoContato && e.ultimoContato >= inicioMes).length,
  }
  for (const e of carteira) resumo.porBucket[e.bucket] = (resumo.porBucket[e.bucket] ?? 0) + 1

  const disponiveis = carteira.filter((e) => !cooldown.has(e.id) && !e.noFunil)
  const porBucket = (b: Bucket) => disponiveis.filter((e) => e.bucket === b).sort((x, y) => ordena(b, x, y))

  const pools: Record<Bucket, Empresa[]> = {
    recompra: porBucket('recompra'),
    reativacao: porBucket('reativacao'),
    extra: porBucket('extra'),
    primeiro_contato: porBucket('primeiro_contato'),
  }

  const escolhidas: Array<{ empresa: Empresa; bucket: Bucket }> = []
  const usados = new Set<string>()

  function puxa(bucket: Bucket, quantidade: number, deOndeVeio: Bucket = bucket): number {
    let pegos = 0
    for (const e of pools[bucket]) {
      if (pegos >= quantidade) break
      if (usados.has(e.id)) continue
      usados.add(e.id)
      escolhidas.push({ empresa: e, bucket: deOndeVeio })
      pegos++
    }
    return pegos
  }

  // Recompra: se secar, puxa da reativação mais morna.
  const recompra = puxa('recompra', COTA_DIARIA.recompra)
  const faltaRecompra = COTA_DIARIA.recompra - recompra

  // Reativação: cota cheia + o que sobrou da recompra.
  const alvoReativacao = COTA_DIARIA.reativacao + faltaRecompra
  const reativacao = puxa('reativacao', alvoReativacao)

  // Se a reativação também secar, completa com primeiro contato.
  const faltaReativacao = alvoReativacao - reativacao
  if (faltaReativacao > 0) puxa('primeiro_contato', faltaReativacao)

  // Extras: clientes recentes, para sugerir o próximo evento.
  puxa('extra', COTA_DIARIA.extra)

  const itens: ItemDiario[] = escolhidas.map(({ empresa, bucket }) => ({
    farmerId,
    data: hoje,
    companyId: empresa.id,
    companyName: empresa.nome,
    bucket: empresa.bucket === 'nutricao' ? bucket : empresa.bucket,
    diasDesdeCompra: empresa.diasDesdeCompra,
    ultimaCompra: empresa.ultimaCompra,
    ultimoContato: empresa.ultimoContato,
    marcado: false,
    abordagem: ABORDAGEM_PADRAO[empresa.bucket === 'nutricao' ? bucket : empresa.bucket],
    observacao: null,
    resultado: null,
  }))

  return { itens, resumo }
}
