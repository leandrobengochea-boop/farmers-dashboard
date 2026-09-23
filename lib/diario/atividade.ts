import { fetchWithRetry, searchAllPages } from './carteira'
import { ItemDiario, atualizaItem } from './db'

/**
 * Atividade registrada no HubSpot hoje, por empresa. É a fonte do fechamento:
 * o farmer já registra ligação e reunião no CRM, e pedir para digitar de novo
 * no diário é retrabalho que mata a adoção.
 */
export interface AtividadeEmpresa {
  ligacoes: number
  conectadas: number
  reunioes: number
  outras: number              // e-mails e notas
  mensagens: number           // WhatsApp registrado pela automação
  texto: string               // anotação mais recente, já sem HTML
  resultadoSugerido: 'efetivo' | 'tentativa' | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function semHtml(valor: string): string {
  return valor.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Disposições que significam que alguém do outro lado atendeu. */
async function disposicoesEfetivas(pat: string): Promise<Set<string>> {
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

async function porEmpresa(pat: string, objeto: string, ids: string[]): Promise<Map<string, string[]>> {
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
 * Atividade do dia de vários farmers de uma vez. Uma busca por tipo de
 * engajamento para o time inteiro: a agenda do líder precisa disso a cada
 * carga, e 23 consultas separadas por farmer inviabilizariam a tela.
 */
export async function atividadeDeVarios(farmerIds: string[], dia: string): Promise<Map<string, Map<string, AtividadeEmpresa>>> {
  const porFarmer = new Map<string, Map<string, AtividadeEmpresa>>()
  for (const id of farmerIds) porFarmer.set(id, new Map())
  const pat = process.env.HUBSPOT_PAT
  if (!pat || farmerIds.length === 0) return porFarmer

  const inicio = String(new Date(`${dia}T00:00:00-03:00`).getTime())
  const fim = String(new Date(`${dia}T23:59:59-03:00`).getTime())
  const janela = (prop: string) => [
    { propertyName: 'hubspot_owner_id', operator: 'IN', values: farmerIds },
    { propertyName: prop, operator: 'GTE', value: inicio },
    { propertyName: prop, operator: 'LTE', value: fim },
  ]

  const [efetivas, ligacoes, reunioes, emails, notas, mensagens] = await Promise.all([
    disposicoesEfetivas(pat),
    searchAllPages(pat, 'calls', [{ filters: janela('hs_timestamp') }], ['hs_call_disposition', 'hs_call_body', 'hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'meetings', [{ filters: janela('hs_timestamp') }], ['hs_meeting_outcome', 'hs_meeting_body', 'hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'emails', [{ filters: janela('hs_timestamp') }], ['hubspot_owner_id']).catch(() => []),
    searchAllPages(pat, 'notes', [{ filters: janela('hs_timestamp') }], ['hs_note_body', 'hubspot_owner_id']).catch(() => []),
    // WhatsApp entra pelo objeto `communications`, não por `calls` — a automação
    // grava a conversa aí, e sem isso o diário não enxerga o canal mais usado.
    searchAllPages(pat, 'communications', [{ filters: janela('hs_timestamp') }], ['hs_communication_body', 'hubspot_owner_id']).catch(() => []),
  ])

  function registra(dono: string, empresa: string): AtividadeEmpresa | null {
    const mapa = porFarmer.get(dono)
    if (!mapa) return null
    let a = mapa.get(empresa)
    if (!a) {
      a = { ligacoes: 0, conectadas: 0, reunioes: 0, outras: 0, mensagens: 0, texto: '', resultadoSugerido: null }
      mapa.set(empresa, a)
    }
    return a
  }

  const [empLigacoes, empReunioes, empEmails, empNotas, empMensagens] = await Promise.all([
    porEmpresa(pat, 'calls', ligacoes.map((c) => c.id)),
    porEmpresa(pat, 'meetings', reunioes.map((m) => m.id)),
    porEmpresa(pat, 'emails', emails.map((e) => e.id)),
    porEmpresa(pat, 'notes', notas.map((n) => n.id)),
    porEmpresa(pat, 'communications', mensagens.map((c) => c.id)),
  ])

  for (const c of ligacoes) {
    const conectou = efetivas.has(c.properties.hs_call_disposition ?? '')
    const texto = semHtml(c.properties.hs_call_body ?? '')
    for (const empresa of empLigacoes.get(c.id) ?? []) {
      const a = registra(c.properties.hubspot_owner_id ?? '', empresa)
      if (!a) continue
      a.ligacoes++
      if (conectou) a.conectadas++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }
  for (const m of reunioes) {
    const realizada = m.properties.hs_meeting_outcome === 'COMPLETED'
    const texto = semHtml(m.properties.hs_meeting_body ?? '')
    for (const empresa of empReunioes.get(m.id) ?? []) {
      const a = registra(m.properties.hubspot_owner_id ?? '', empresa)
      if (!a) continue
      if (realizada) a.reunioes++
      else a.outras++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }
  for (const e of emails) {
    for (const empresa of empEmails.get(e.id) ?? []) {
      const a = registra(e.properties.hubspot_owner_id ?? '', empresa)
      if (a) a.outras++
    }
  }
  for (const n of notas) {
    const texto = semHtml(n.properties.hs_note_body ?? '')
    for (const empresa of empNotas.get(n.id) ?? []) {
      const a = registra(n.properties.hubspot_owner_id ?? '', empresa)
      if (!a) continue
      a.outras++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }

  for (const c of mensagens) {
    for (const empresa of empMensagens.get(c.id) ?? []) {
      const a = registra(c.properties.hubspot_owner_id ?? '', empresa)
      if (a) a.mensagens++
    }
  }

  for (const mapa of porFarmer.values()) {
    for (const a of mapa.values()) {
      // Mensagem de WhatsApp nunca vira "efetivo" sozinha: o registro não diz se
      // o cliente respondeu, e chutar isso inflaria a efetividade do time todo.
      if (a.conectadas > 0 || a.reunioes > 0) a.resultadoSugerido = 'efetivo'
      else if (a.ligacoes > 0 || a.outras > 0 || a.mensagens > 0) a.resultadoSugerido = 'tentativa'
    }
  }
  return porFarmer
}

export async function atividadeDoDia(farmerId: string, dia: string): Promise<Map<string, AtividadeEmpresa>> {
  const porFarmer = await atividadeDeVarios([farmerId], dia)
  return porFarmer.get(farmerId) ?? new Map()
}

/**
 * Escreve no diário o que o HubSpot já sabe. Só preenche o que está vazio:
 * escolha feita à mão pelo farmer ou pelo líder nunca é sobrescrita.
 * Muta os itens recebidos, para quem chamou responder com o dado já atualizado.
 */
export async function aplicaAtividade(
  farmerId: string,
  data: string,
  itens: ItemDiario[],
  atividade: Map<string, AtividadeEmpresa>,
): Promise<void> {
  for (const item of itens) {
    const a = atividade.get(item.companyId)
    if (!a?.resultadoSugerido) continue
    const preencheResultado = !item.resultado
    const preencheTexto = !item.observacaoResultado?.trim() && !!a.texto
    if (!preencheResultado && !preencheTexto) continue

    if (preencheResultado) item.resultado = a.resultadoSugerido
    if (preencheTexto) item.observacaoResultado = a.texto.slice(0, 600)
    await atualizaItem(farmerId, data, item.companyId, {
      ...(preencheResultado ? { resultado: a.resultadoSugerido } : {}),
      ...(preencheTexto ? { observacaoResultado: a.texto.slice(0, 600) } : {}),
    }).catch(() => {})
  }
}
