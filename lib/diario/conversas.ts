/**
 * O que o CRM sabe sobre a conversa em si — não o que alguém digitou numa
 * propriedade depois.
 *
 * Mora aqui o que `atividade.ts` (resultado do dia) e `carteira.ts` (quem entra
 * na lista) precisam enxergar igual: quem atendeu, quem respondeu e quando.
 */
import { fetchWithRetry, searchAllPages } from './carteira'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Disposições que significam que alguém do outro lado atendeu. */
export async function disposicoesEfetivas(pat: string): Promise<Set<string>> {
  try {
    const resp = await fetchWithRetry('https://api.hubapi.com/calling/v1/dispositions', {
      headers: { Authorization: `Bearer ${pat}` },
      cache: 'no-store',
    })
    if (!resp.ok) return new Set()
    const data = (await resp.json()) as Array<{ id: string; label: string; deleted: boolean }>
    return new Set(
      data
        .filter((o) => {
          if (o.deleted) return false
          const l = o.label.toLowerCase()
          return l.includes('conect') || l.includes('connect') || l.includes('atend') || l.includes('reunião agendada')
        })
        .map((o) => o.id),
    )
  } catch {
    return new Set()
  }
}

export async function porEmpresa(pat: string, objeto: string, ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 100) {
    if (i > 0) await sleep(120)
    const resp = await fetchWithRetry(`https://api.hubapi.com/crm/v4/associations/${objeto}/companies/batch/read`, {
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
 * Conversa de WhatsApp em que o cliente respondeu.
 *
 * A automação grava o fio inteiro no corpo do registro e **não existe campo de
 * direção** — nenhuma das 55 propriedades diz se a mensagem saiu ou chegou. O
 * que separa os dois lados é o alinhamento do bloco: o que a gente mandou vem
 * com `text-align:right` (e o nome em azul), o que chegou vem sem.
 *
 * O corte é no bloco de mensagem (`margin-bottom:12px`), não em qualquer
 * `<div>`: o corpo tem divs de embrulho que não são mensagem, e olhar todas
 * elas dava "respondida" para 99% dos registros.
 *
 * Registro sem corpo (os que vieram da caixa de entrada, `CONVERSATIONS`) não
 * dá para classificar: fica como não respondida, para não inventar efetivo.
 */
export function conversaRespondida(corpo: string): boolean {
  if (!corpo) return false
  const blocos = corpo.split('<div style="margin-bottom:12px').slice(1)
  return blocos.some((b) => !b.slice(0, 40).includes('text-align:right'))
}

/**
 * Último contato efetivo que o CRM registra para cada empresa, olhando o
 * engajamento em si — ligação atendida, reunião realizada e conversa de
 * WhatsApp respondida pelo cliente.
 *
 * Existe porque a propriedade `ultimo_contato_efetivo` é preenchida à mão e
 * erra nos dois sentidos. Aqui o dado é o próprio registro do contato, e vale
 * para qualquer pessoa que tenha falado com a empresa — líder, CS, outro time
 * — não só para o dono da carteira.
 *
 * Consulta por empresa (`associations.company`), não por dono: é o que mantém
 * a conta pequena o bastante para rodar na geração da lista do dia.
 */
export async function contatoEfetivoNoCRM(
  companyIds: string[],
  desde: string,
): Promise<Map<string, string>> {
  const achados = new Map<string, string>()
  const pat = process.env.HUBSPOT_PAT
  if (!pat || companyIds.length === 0) return achados

  const desdeMs = String(new Date(`${desde}T00:00:00-03:00`).getTime())
  const efetivas = await disposicoesEfetivas(pat)

  const marca = (empresa: string, quando: string | null | undefined) => {
    const dia = (quando ?? '').slice(0, 10)
    if (!dia) return
    const atual = achados.get(empresa)
    if (!atual || atual < dia) achados.set(empresa, dia)
  }

  // Lotes pequenos: a busca é por lista de empresas e o retorno carrega o corpo
  // inteiro das conversas, que é grande.
  const LOTE = 40
  for (let i = 0; i < companyIds.length; i += LOTE) {
    const lote = companyIds.slice(i, i + LOTE)
    const janela = [
      { propertyName: 'associations.company', operator: 'IN', values: lote },
      { propertyName: 'hs_timestamp', operator: 'GTE', value: desdeMs },
    ]

    // Em fila, não em paralelo: a busca do HubSpot tem limite por segundo e o
    // 429 engolido vira lista vazia — ou seja, empresa sugerida de novo.
    const ligacoes = await searchAllPages(pat, 'calls', [{ filters: janela }], ['hs_timestamp', 'hs_call_disposition'])
    const reunioes = await searchAllPages(pat, 'meetings', [{ filters: janela }], ['hs_timestamp', 'hs_meeting_outcome'])
    const conversas = await searchAllPages(pat, 'communications', [{ filters: janela }], ['hs_timestamp', 'hs_communication_body'])

    const atendidas = ligacoes.filter((c) => efetivas.has(c.properties.hs_call_disposition ?? ''))
    const realizadas = reunioes.filter((m) => m.properties.hs_meeting_outcome === 'COMPLETED')
    const respondidas = conversas.filter((c) => conversaRespondida(c.properties.hs_communication_body ?? ''))

    const [empLigacoes, empReunioes, empConversas] = await Promise.all([
      porEmpresa(pat, 'calls', atendidas.map((c) => c.id)),
      porEmpresa(pat, 'meetings', realizadas.map((m) => m.id)),
      porEmpresa(pat, 'communications', respondidas.map((c) => c.id)),
    ])

    for (const c of atendidas) for (const e of empLigacoes.get(c.id) ?? []) marca(e, c.properties.hs_timestamp)
    for (const m of realizadas) for (const e of empReunioes.get(m.id) ?? []) marca(e, m.properties.hs_timestamp)
    for (const c of respondidas) for (const e of empConversas.get(c.id) ?? []) marca(e, c.properties.hs_timestamp)
  }
  return achados
}
