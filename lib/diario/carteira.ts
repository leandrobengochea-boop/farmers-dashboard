import { HUBSPOT_PORTAL_ID } from '../constants'
import {
  Bucket, COTA_DIARIA, COOLDOWN_POR_RESULTADO, COOLDOWN_SEM_RESULTADO, TENTATIVAS_ATE_AUXILIO,
} from './constants'
import { HistoricoEmpresa, ItemDiario, historicoDoFarmer } from './db'

export interface Empresa {
  id: string
  nome: string
  ultimaCompra: string | null    // YYYY-MM-DD
  ultimoContato: string | null   // YYYY-MM-DD (ultimo_contato_efetivo)
  cidade: string
  hubspotUrl: string
  bucket: Bucket
  diasDesdeCompra: number | null
  noFunil: boolean               // já tem negócio aberto com este farmer
}

export interface ResumoPool {
  carteira: number
  comHistorico: number
  porBucket: Record<string, number>
  emCooldown: number
  precisandoAuxilio: number
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
 * Descanso depende do que aconteceu da última vez: 1 dia se não foi abordada,
 * 3 se tentou e não falou, 30 se o contato foi efetivo.
 */
export function emDescanso(h: HistoricoEmpresa | undefined, hoje: string): boolean {
  if (!h?.ultimaData) return false
  const exigido = h.ultimoResultado
    ? (COOLDOWN_POR_RESULTADO[h.ultimoResultado] ?? COOLDOWN_SEM_RESULTADO)
    : COOLDOWN_SEM_RESULTADO
  return diasEntre(h.ultimaData, hoje) < exigido
}

/**
 * Três "não atendeu" seguidos: a empresa continua na lista, mas marcada como
 * pedido de auxílio do líder.
 */
export function precisaAuxilio(h: HistoricoEmpresa | undefined): boolean {
  return (h?.tentativasSeguidas ?? 0) >= TENTATIVAS_ATE_AUXILIO
}

/**
 * Classifica a empresa pelo tempo desde a última contratação.
 * 0–3 entre eventos · 3–8 nutrição · 8–12 recompra · 12+ reativação.
 */
export function classifica(ultimaCompra: string | null, hoje: string): { bucket: Bucket; dias: number | null } {
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
 * - recompra e nutrição: mais perto de estourar a janela primeiro (compra mais antiga na frente)
 * - reativação: a mais "morna" primeiro (compra mais recente na frente)
 * - extra: a mais recente na frente
 * Desempate sempre por quem está há mais tempo sem contato efetivo.
 */
function ordena(bucket: Bucket, a: Empresa, b: Empresa): number {
  if (bucket === 'recompra' || bucket === 'nutricao') {
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
 * Monta a lista do dia: 5 recompra + 3 nutrição + 12 reativação (as 20 para
 * abordar) mais 3 extras de clientes recentes. O que faltar num balde é
 * completado pelos outros, na ordem reativação → nutrição → recompra →
 * primeiro contato, para o farmer nunca receber menos de 20.
 */
export async function montaSugestoes(farmerId: string, hoje: string): Promise<Sugestoes> {
  const carteira = await fetchCarteira(farmerId, hoje)
  const historico = await historicoDoFarmer(farmerId, hoje)
  const inicioMes = `${hoje.slice(0, 7)}-01`


  const resumo: ResumoPool = {
    carteira: carteira.length,
    comHistorico: carteira.filter((e) => e.ultimaCompra).length,
    porBucket: {},
    emCooldown: carteira.filter((e) => emDescanso(historico.get(e.id), hoje)).length,
    precisandoAuxilio: carteira.filter((e) => precisaAuxilio(historico.get(e.id))).length,
    noFunil: carteira.filter((e) => e.noFunil).length,
    contatoEfetivoNoMes: carteira.filter((e) => e.ultimoContato && e.ultimoContato >= inicioMes).length,
  }
  for (const e of carteira) resumo.porBucket[e.bucket] = (resumo.porBucket[e.bucket] ?? 0) + 1

  const disponiveis = carteira.filter((e) => !emDescanso(historico.get(e.id), hoje) && !e.noFunil)
  const pools = {} as Record<Bucket, Empresa[]>
  for (const b of ['recompra', 'nutricao', 'reativacao', 'extra', 'primeiro_contato'] as Bucket[]) {
    pools[b] = disponiveis
      .filter((e) => e.bucket === b)
      // quem pediu auxílio vai na frente do próprio balde: de nada adianta
      // marcar a empresa se ela não entrar na lista do dia
      .sort((x, y) => {
        const ax = precisaAuxilio(historico.get(x.id)) ? 0 : 1
        const ay = precisaAuxilio(historico.get(y.id)) ? 0 : 1
        return ax - ay || ordena(b, x, y)
      })
  }

  const escolhidas: Empresa[] = []
  const usados = new Set<string>()

  function puxa(bucket: Bucket, quantidade: number): number {
    let pegos = 0
    for (const e of pools[bucket]) {
      if (pegos >= quantidade) break
      if (usados.has(e.id)) continue
      usados.add(e.id)
      escolhidas.push(e)
      pegos++
    }
    return pegos
  }

  const cotas: Array<[Bucket, number]> = [
    ['recompra', COTA_DIARIA.recompra],
    ['nutricao', COTA_DIARIA.nutricao],
    ['reativacao', COTA_DIARIA.reativacao],
  ]
  let alvo = 0
  for (const [bucket, cota] of cotas) {
    alvo += cota
    puxa(bucket, cota)
  }

  // Completa o que faltou para fechar as 20, do balde mais cheio de oportunidade
  // para o mais frio.
  for (const bucket of ['reativacao', 'nutricao', 'recompra', 'primeiro_contato'] as Bucket[]) {
    const falta = alvo - escolhidas.length
    if (falta <= 0) break
    puxa(bucket, falta)
  }

  // Extras: clientes recentes, para sugerir o próximo evento. Fora da conta das 20.
  puxa('extra', COTA_DIARIA.extra)

  const itens: ItemDiario[] = escolhidas.map((empresa) => ({
    farmerId,
    data: hoje,
    companyId: empresa.id,
    companyName: empresa.nome,
    bucket: empresa.bucket,
    diasDesdeCompra: empresa.diasDesdeCompra,
    ultimaCompra: empresa.ultimaCompra,
    ultimoContato: empresa.ultimoContato,
    // sem abordagem padrão: escolher a abordagem é a decisão da manhã
    abordagem: null,
    observacao: null,
    resultado: null,
    observacaoResultado: null,
  }))

  return { itens, resumo }
}
