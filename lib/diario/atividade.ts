import { fetchWithRetry, searchAllPages } from './carteira'

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

export async function atividadeDoDia(farmerId: string, dia: string): Promise<Map<string, AtividadeEmpresa>> {
  const fora = new Map<string, AtividadeEmpresa>()
  const pat = process.env.HUBSPOT_PAT
  if (!pat) return fora

  const inicio = String(new Date(`${dia}T00:00:00-03:00`).getTime())
  const fim = String(new Date(`${dia}T23:59:59-03:00`).getTime())
  const janela = (prop: string) => [
    { propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId },
    { propertyName: prop, operator: 'GTE', value: inicio },
    { propertyName: prop, operator: 'LTE', value: fim },
  ]

  const [efetivas, ligacoes, reunioes, emails, notas] = await Promise.all([
    disposicoesEfetivas(pat),
    searchAllPages(pat, 'calls', [{ filters: janela('hs_timestamp') }], ['hs_call_disposition', 'hs_call_body', 'hs_timestamp']).catch(() => []),
    searchAllPages(pat, 'meetings', [{ filters: janela('hs_timestamp') }], ['hs_meeting_outcome', 'hs_meeting_body', 'hs_timestamp']).catch(() => []),
    searchAllPages(pat, 'emails', [{ filters: janela('hs_timestamp') }], ['hs_email_subject']).catch(() => []),
    searchAllPages(pat, 'notes', [{ filters: janela('hs_timestamp') }], ['hs_note_body']).catch(() => []),
  ])

  function registra(empresa: string): AtividadeEmpresa {
    let a = fora.get(empresa)
    if (!a) {
      a = { ligacoes: 0, conectadas: 0, reunioes: 0, outras: 0, texto: '', resultadoSugerido: null }
      fora.set(empresa, a)
    }
    return a
  }

  const [empLigacoes, empReunioes, empEmails, empNotas] = await Promise.all([
    porEmpresa(pat, 'calls', ligacoes.map((c) => c.id)),
    porEmpresa(pat, 'meetings', reunioes.map((m) => m.id)),
    porEmpresa(pat, 'emails', emails.map((e) => e.id)),
    porEmpresa(pat, 'notes', notas.map((n) => n.id)),
  ])

  for (const c of ligacoes) {
    const conectou = efetivas.has(c.properties.hs_call_disposition ?? '')
    const texto = semHtml(c.properties.hs_call_body ?? '')
    for (const empresa of empLigacoes.get(c.id) ?? []) {
      const a = registra(empresa)
      a.ligacoes++
      if (conectou) a.conectadas++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }
  for (const m of reunioes) {
    const realizada = m.properties.hs_meeting_outcome === 'COMPLETED'
    const texto = semHtml(m.properties.hs_meeting_body ?? '')
    for (const empresa of empReunioes.get(m.id) ?? []) {
      const a = registra(empresa)
      if (realizada) a.reunioes++
      else a.outras++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }
  for (const e of emails) {
    for (const empresa of empEmails.get(e.id) ?? []) registra(empresa).outras++
  }
  for (const n of notas) {
    const texto = semHtml(n.properties.hs_note_body ?? '')
    for (const empresa of empNotas.get(n.id) ?? []) {
      const a = registra(empresa)
      a.outras++
      if (texto && texto.length > a.texto.length) a.texto = texto
    }
  }

  for (const a of fora.values()) {
    if (a.conectadas > 0 || a.reunioes > 0) a.resultadoSugerido = 'efetivo'
    else if (a.ligacoes > 0 || a.outras > 0) a.resultadoSugerido = 'tentativa'
  }
  return fora
}
