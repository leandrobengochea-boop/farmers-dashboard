import { HUBSPOT_PORTAL_ID } from '../constants'
import {
  Bucket, COTA_DIARIA, COOLDOWN_POR_RESULTADO, COOLDOWN_SEM_RESULTADO, DIAS_NEGOCIACAO_PARADA,
  ETAPAS_FUNIL_ATIVO, LIMITE_MESES, PIPELINE_B2B, TENTATIVAS_ATE_AUXILIO, urlEmpresa,
} from './constants'
import { HistoricoEmpresa, ItemDiario, historicoDoFarmer, trocasPendentes } from './db'

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
  negociacao: Negociacao | null  // negócio vivo no funil B2B, nas etapas ativas
}

/** Negócio em andamento no funil B2B — o que a empresa já tem na mesa. */
export interface Negociacao {
  dealId: string
  etapa: string                  // rótulo legível, nunca o id
  diasNaEtapa: number
  parada: boolean                // passou de DIAS_NEGOCIACAO_PARADA sem andar
  hubspotUrl: string
}

export interface ResumoPool {
  carteira: number
  comHistorico: number
  porBucket: Record<string, number>
  emCooldown: number
  precisandoAuxilio: number
  noFunil: number
  negociando: number
  negociacaoParada: number
  contatoEfetivoNoMes: number
  trocandoSegmento: number
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
  if (ultimaCompra > menosMeses(hoje, LIMITE_MESES.entreEventos)) return { bucket: 'extra', dias }
  if (ultimaCompra <= menosMeses(hoje, LIMITE_MESES.recompra)) return { bucket: 'reativacao', dias }
  if (ultimaCompra <= menosMeses(hoje, LIMITE_MESES.nutricao)) return { bucket: 'recompra', dias }
  return { bucket: 'nutricao', dias }
}

/** Empresas com negócio aberto deste farmer — já estão sendo trabalhadas. */
/**
 * Negócios abertos do farmer. Devolve duas coisas: o conjunto de empresas que
 * saem do rodízio (qualquer negócio aberto, em qualquer funil) e o detalhe das
 * que estão numa etapa ativa do funil B2B, que é o que o farmer acompanha.
 */
async function empresasNoFunil(
  pat: string, farmerId: string, hoje: string,
): Promise<{ todas: Set<string>; negociando: Map<string, Negociacao> }> {
  const etapas = Object.keys(ETAPAS_FUNIL_ATIVO)
  const deals = await searchAllPages(
    pat,
    'deals',
    [{ filters: [
      { propertyName: 'sdrfarmer_responsavel', operator: 'EQ', value: farmerId },
      { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' },
    ] }],
    ['dealname', 'pipeline', 'dealstage', ...etapas.map((e) => `hs_v2_date_entered_${e}`)],
  ).catch(() => [])

  const ids = deals.map((d) => d.id)
  const empresas = new Set<string>()
  const negociando = new Map<string, Negociacao>()
  const porDeal = new Map<string, string[]>()
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
    const data = (await resp.json()) as { results?: Array<{ from: { id: string }; to: Array<{ toObjectId: number | string }> }> }
    for (const row of data.results ?? []) {
      const alvos = (row.to ?? []).map((t) => String(t.toObjectId))
      for (const t of alvos) empresas.add(t)
      porDeal.set(row.from.id, alvos)
    }
  }

  for (const d of deals) {
    const etapa = d.properties.dealstage ?? ''
    if (d.properties.pipeline !== PIPELINE_B2B || !ETAPAS_FUNIL_ATIVO[etapa]) continue
    const entrou = d.properties[`hs_v2_date_entered_${etapa}`]
    const diasNaEtapa = entrou ? diasEntre(String(entrou).slice(0, 10), hoje) : 0
    for (const empresa of porDeal.get(d.id) ?? []) {
      // empresa com mais de um negócio fica com o mais parado: é o que precisa de ação
      const atual = negociando.get(empresa)
      if (atual && atual.diasNaEtapa >= diasNaEtapa) continue
      negociando.set(empresa, {
        dealId: d.id,
        etapa: ETAPAS_FUNIL_ATIVO[etapa],
        diasNaEtapa,
        parada: diasNaEtapa > DIAS_NEGOCIACAO_PARADA,
        hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${d.id}`,
      })
    }
  }
  return { todas: empresas, negociando }
}

/** Nome das empresas, em lote. Usado quando o negócio aponta para fora da carteira. */
async function nomesDeEmpresas(ids: string[]): Promise<Map<string, string>> {
  const nomes = new Map<string, string>()
  const pat = process.env.HUBSPOT_PAT
  if (!pat || ids.length === 0) return nomes
  for (let i = 0; i < ids.length; i += 100) {
    const resp = await fetchWithRetry('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: ['name'], inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
    })
    if (!resp.ok) continue
    const data = (await resp.json()) as { results?: Array<{ id: string; properties: Record<string, string> }> }
    for (const r of data.results ?? []) nomes.set(r.id, r.properties.name ?? `Empresa ${r.id}`)
  }
  return nomes
}

/**
 * Negócios vivos do farmer no funil B2B, nas etapas ativas. Fica separado da
 * carteira porque a lista do dia é congelada na primeira abertura, e o estado
 * da negociação muda depois disso — o farmer precisa ver como está agora.
 */
export async function negociacoesAtivas(farmerId: string, hoje: string): Promise<NegociacaoEmpresa[]> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) return []
  const { negociando } = await empresasNoFunil(pat, farmerId, hoje)
  if (negociando.size === 0) return []

  const ids = [...negociando.keys()]
  const nomes = await nomesDeEmpresas(ids)

  return ids
    .map((companyId) => ({
      companyId,
      companyName: nomes.get(companyId) ?? `Empresa ${companyId}`,
      empresaUrl: urlEmpresa(companyId),
      ...negociando.get(companyId)!,
    }))
    .sort((a, b) => b.diasNaEtapa - a.diasNaEtapa)
}

export type NegociacaoEmpresa = Negociacao & {
  companyId: string
  companyName: string
  empresaUrl: string
}

export async function fetchCarteira(
  farmerId: string, hoje: string,
): Promise<{ empresas: Empresa[]; negociacoes: Map<string, Negociacao> }> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  const [rows, funil] = await Promise.all([
    searchAllPages(
      pat,
      'companies',
      [{ filters: [{ propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId }] }],
      ['name', 'data_da_ultima_compra', 'ultimo_contato_efetivo', 'city'],
    ),
    empresasNoFunil(pat, farmerId, hoje),
  ])

  const empresas = rows.map((r) => {
    const ultimaCompra = (r.properties.data_da_ultima_compra ?? '')?.slice(0, 10) || null
    const { bucket, dias } = classifica(ultimaCompra, hoje)
    return {
      id: r.id,
      nome: r.properties.name ?? `Empresa ${r.id}`,
      ultimaCompra,
      ultimoContato: (r.properties.ultimo_contato_efetivo ?? '')?.slice(0, 10) || null,
      cidade: r.properties.city ?? '',
      hubspotUrl: urlEmpresa(r.id),
      bucket,
      diasDesdeCompra: dias,
      noFunil: funil.todas.has(r.id),
      negociacao: funil.negociando.get(r.id) ?? null,
    }
  })
  return { empresas, negociacoes: funil.negociando }
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
  const { empresas: carteira, negociacoes } = await fetchCarteira(farmerId, hoje)
  const historico = await historicoDoFarmer(farmerId, hoje)
  // Empresa com troca de segmento em aberto não volta: ela é o problema,
  // não a tarefa. Volta sozinha se o líder disser que o segmento está certo.
  const trocando = (await trocasPendentes([farmerId])).get(farmerId) ?? new Map()
  const inicioMes = `${hoje.slice(0, 7)}-01`


  const resumo: ResumoPool = {
    carteira: carteira.length,
    comHistorico: carteira.filter((e) => e.ultimaCompra).length,
    porBucket: {},
    emCooldown: carteira.filter((e) => emDescanso(historico.get(e.id), hoje)).length,
    precisandoAuxilio: carteira.filter((e) => precisaAuxilio(historico.get(e.id))).length,
    noFunil: carteira.filter((e) => e.noFunil).length,
    contatoEfetivoNoMes: carteira.filter((e) => e.ultimoContato && e.ultimoContato >= inicioMes).length,
    trocandoSegmento: carteira.filter((e) => trocando.has(e.id)).length,
    negociando: carteira.filter((e) => e.negociacao).length,
    negociacaoParada: carteira.filter((e) => e.negociacao?.parada).length,
  }
  for (const e of carteira) resumo.porBucket[e.bucket] = (resumo.porBucket[e.bucket] ?? 0) + 1

  const disponiveis = carteira.filter(
    (e) => !emDescanso(historico.get(e.id), hoje) && !e.noFunil && !trocando.has(e.id),
  )
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

  // Extras: negócio que está na mesa e parou de andar vem primeiro — destravar o
  // que já existe vale mais que qualquer abordagem nova. O que sobrar de vaga
  // volta a ser cliente recente. Tudo isso fora da conta das 20.
  const porId = new Map(carteira.map((e) => [e.id, e]))
  const paradas = [...negociacoes.entries()]
    .filter(([id, n]) => n.parada && !usados.has(id) && !trocando.has(id) && !emDescanso(historico.get(id), hoje))
    .sort((a, b) => b[1].diasNaEtapa - a[1].diasNaEtapa)
    .slice(0, COTA_DIARIA.extra)

  const nomes = await nomesDeEmpresas(paradas.filter(([id]) => !porId.has(id)).map(([id]) => id))
  for (const [id, n] of paradas) {
    usados.add(id)
    const daCarteira = porId.get(id)
    escolhidas.push({
      ...(daCarteira ?? {
        id,
        nome: nomes.get(id) ?? `Empresa ${id}`,
        ultimaCompra: null,
        ultimoContato: null,
        cidade: '',
        hubspotUrl: urlEmpresa(id),
        diasDesdeCompra: null,
        noFunil: true,
        negociacao: n,
      }),
      bucket: 'negociacao',
    })
  }
  puxa('extra', COTA_DIARIA.extra - paradas.length)

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
    editadoPor: null,
  }))

  return { itens, resumo }
}
