import { fetchWithRetry, searchAllPages } from './carteira'

/**
 * Selo de relacionamento: a empresa tem histórico construído com o dono ATUAL
 * da carteira — ele registrou negócio e já realizou mais de uma reunião de
 * relacionamento com ela. O sinal é da pessoa, não da empresa: herdar carteira
 * não herda relacionamento.
 */
export const MINIMO_REUNIOES_RELACIONAMENTO = 2
const TIPO_REUNIAO = 'Reunião de Relacionamento'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function associadas(pat: string, de: string, para: string, ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 100) {
    if (i > 0) await sleep(120)
    const resp = await fetchWithRetry(`https://api.hubapi.com/crm/v4/associations/${de}/${para}/batch/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
    })
    if (!resp.ok) continue
    const data = (await resp.json()) as { results?: Array<{ from: { id: string }; to: Array<{ toObjectId: number | string }> }> }
    for (const row of data.results ?? []) {
      mapa.set(row.from.id, (row.to ?? []).map((t) => String(t.toObjectId)))
    }
  }
  return mapa
}

/**
 * Quais das empresas informadas têm o selo, para este farmer.
 * Parte das reuniões (conjunto pequeno) e só então confere o negócio, para não
 * varrer a carteira inteira de negócios a cada abertura do diário.
 */
export async function empresasComSelo(farmerId: string, companyIds: string[]): Promise<Set<string>> {
  const selo = new Set<string>()
  const pat = process.env.HUBSPOT_PAT
  if (!pat || companyIds.length === 0) return selo

  // 1. reuniões de relacionamento realizadas por este farmer
  const reunioes = await searchAllPages(
    pat,
    'meetings',
    [{ filters: [
      { propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId },
      { propertyName: 'hs_activity_type', operator: 'EQ', value: TIPO_REUNIAO },
      { propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' },
    ] }],
    ['hs_meeting_title'],
  ).catch(() => [])
  if (reunioes.length === 0) return selo

  const porEmpresa = new Map<string, number>()
  const assoc = await associadas(pat, 'meetings', 'companies', reunioes.map((r) => r.id))
  for (const empresas of assoc.values()) {
    for (const e of empresas) porEmpresa.set(e, (porEmpresa.get(e) ?? 0) + 1)
  }

  const naLista = new Set(companyIds)
  const candidatas = [...porEmpresa.entries()]
    .filter(([empresa, total]) => total >= MINIMO_REUNIOES_RELACIONAMENTO && naLista.has(empresa))
    .map(([empresa]) => empresa)
  if (candidatas.length === 0) return selo

  // 2. entre as candidatas, quais têm negócio registrado por este mesmo farmer
  const negociosPorEmpresa = await associadas(pat, 'companies', 'deals', candidatas)
  const dealIds = [...new Set([...negociosPorEmpresa.values()].flat())]
  if (dealIds.length === 0) return selo

  const donoDoNegocio = new Map<string, string>()
  for (let i = 0; i < dealIds.length; i += 100) {
    if (i > 0) await sleep(120)
    const resp = await fetchWithRetry('https://api.hubapi.com/crm/v3/objects/deals/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: dealIds.slice(i, i + 100).map((id) => ({ id })), properties: ['sdrfarmer_responsavel'] }),
    })
    if (!resp.ok) continue
    const data = (await resp.json()) as { results?: Array<{ id: string; properties: Record<string, string> }> }
    for (const d of data.results ?? []) donoDoNegocio.set(d.id, d.properties.sdrfarmer_responsavel ?? '')
  }

  for (const empresa of candidatas) {
    const negocios = negociosPorEmpresa.get(empresa) ?? []
    if (negocios.some((id) => donoDoNegocio.get(id) === farmerId)) selo.add(empresa)
  }
  return selo
}
