import {
  ANTECEDENCIA_ASSINATURA_DIAS, ANTECEDENCIA_CHECKLIST_DIAS, ETAPAS_TICKET,
  PRAZO_ASSINATURA_DIAS, PRAZO_MINUTA_DIAS_UTEIS,
  TICKET_PIPELINE_CS, TICKET_STAGES_TRAMITACAO, TipoTramitacao, urlTicket,
} from './constants'
import { fetchWithRetry, searchAllPages } from './carteira'

/** Empresa com evento sendo montado: o CS está no meio do trabalho. */
export interface TramitacaoEmpresa {
  ticketId: string
  assunto: string
  etapa: string
  dataEvento: string | null
  hubspotUrl: string
  companyId: string
  companyName: string
  donoDaEmpresa: string
}

let cacheTramitacao: { em: number; mapa: Map<string, TramitacaoEmpresa> } | null = null
const VALIDADE_TRAMITACAO = 10 * 60 * 1000

/**
 * Empresas com ticket vivo nas etapas ANTES do evento, independente de quem é o
 * dono do ticket — hoje quase todos são do CS, não dos farmers.
 *
 * Serve para tirar a empresa do rodízio de abordagem: oferecer reativação para
 * quem está com evento sendo montado é ruído. Etapa de pós-palestra não entra:
 * ali o evento já aconteceu e falar com o cliente de novo faz sentido.
 */
export async function empresasEmTramitacao(): Promise<Map<string, TramitacaoEmpresa>> {
  if (cacheTramitacao && Date.now() - cacheTramitacao.em < VALIDADE_TRAMITACAO) return cacheTramitacao.mapa
  const mapa = new Map<string, TramitacaoEmpresa>()
  const pat = process.env.HUBSPOT_PAT
  if (!pat) return mapa

  try {
    const tickets = await searchAllPages(pat, 'tickets', [{ filters: [
      { propertyName: 'hs_pipeline', operator: 'EQ', value: TICKET_PIPELINE_CS },
      { propertyName: 'hs_pipeline_stage', operator: 'IN', values: TICKET_STAGES_TRAMITACAO },
    ] }], ['subject', 'hs_pipeline_stage', 'data_do_evento__ganho_'])

    const ids = tickets.map((t) => t.id)
    const empresaDoTicket = new Map<string, string>()
    for (let i = 0; i < ids.length; i += 100) {
      const resp = await fetchWithRetry('https://api.hubapi.com/crm/v4/associations/tickets/companies/batch/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
      })
      if (!resp.ok) continue
      const data = (await resp.json()) as { results?: Array<{ from: { id: string }; to: Array<{ toObjectId: number | string }> }> }
      for (const row of data.results ?? []) {
        const alvo = row.to?.[0]?.toObjectId
        if (alvo) empresaDoTicket.set(row.from.id, String(alvo))
      }
    }

    // nome e dono vêm junto: assim quem precisa da lista de um farmer filtra o
    // cache em memória, sem refazer a busca da carteira
    const alvos = [...new Set(empresaDoTicket.values())]
    const empresa = new Map<string, { nome: string; dono: string }>()
    for (let i = 0; i < alvos.length; i += 100) {
      const resp = await fetchWithRetry('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: ['name', 'hubspot_owner_id'], inputs: alvos.slice(i, i + 100).map((id) => ({ id })) }),
      })
      if (!resp.ok) continue
      const data = (await resp.json()) as { results?: Array<{ id: string; properties: Record<string, string> }> }
      for (const c of data.results ?? []) {
        empresa.set(c.id, { nome: c.properties.name ?? `Empresa ${c.id}`, dono: c.properties.hubspot_owner_id ?? '' })
      }
    }

    for (const t of tickets) {
      const companyId = empresaDoTicket.get(t.id)
      if (!companyId || mapa.has(companyId)) continue
      const dados = empresa.get(companyId)
      mapa.set(companyId, {
        ticketId: t.id,
        assunto: t.properties.subject ?? `Ticket ${t.id}`,
        etapa: ETAPAS_TICKET[t.properties.hs_pipeline_stage ?? ''] ?? '',
        dataEvento: (t.properties.data_do_evento__ganho_ ?? '')?.slice(0, 10) || null,
        hubspotUrl: urlTicket(t.id),
        companyId,
        companyName: dados?.nome ?? `Empresa ${companyId}`,
        donoDaEmpresa: dados?.dono ?? '',
      })
    }
  } catch {
    return mapa
  }
  cacheTramitacao = { em: Date.now(), mapa }
  return mapa
}

/** O que está em tramitação na carteira de um farmer. Lê do cache, sem rede. */
export async function tramitacoesDoFarmer(farmerId: string): Promise<TramitacaoEmpresa[]> {
  const mapa = await empresasEmTramitacao()
  return [...mapa.values()]
    .filter((t) => t.donoDaEmpresa === farmerId)
    .sort((a, b) => (a.dataEvento ?? '9').localeCompare(b.dataEvento ?? '9'))
}

export interface Pendencia {
  ticketId: string
  tipo: TipoTramitacao
  assunto: string
  etapa: string
  prazo: string                 // YYYY-MM-DD
  diasParaPrazo: number         // negativo = vencida
  dataOnboarding: string | null
  dataEvento: string | null
  statusContrato: string | null
  eventoPassado: boolean
  hubspotUrl: string
}

function soData(valor: string | null | undefined): string | null {
  if (!valor) return null
  return valor.slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de}T12:00:00Z`).getTime()
  const b = new Date(`${ate}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

function maisDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Soma dias úteis pulando sábado e domingo. Feriado não é tratado. */
export function maisDiasUteis(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  let restantes = dias
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const semana = d.getUTCDay()
    if (semana !== 0 && semana !== 6) restantes--
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Pendências de tramitação dos tickets abertos do farmer no pipeline CS.
 *
 * - minuta: nasce quando o onboarding já aconteceu; vence 1 dia útil depois
 * - assinatura: mesma origem, vence em 20 dias, mas só aparece na reta final
 *   (baixa sozinha pelo CRM)
 * - checklist: nasce 2 dias antes do evento
 *
 * Contrato assinado baixa tanto a assinatura quanto o envio da minuta: se foi
 * assinado, foi enviado.
 */
export async function pendenciasDeVarios(farmerIds: string[], hoje: string): Promise<Map<string, Pendencia[]>> {
  const fora = new Map<string, Pendencia[]>()
  if (farmerIds.length === 0) return fora
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  // Uma busca só para o time inteiro: 23 consultas separadas deixariam a agenda lenta.
  const tickets = await searchAllPages(
    pat,
    'tickets',
    [{ filters: [
      { propertyName: 'hubspot_owner_id', operator: 'IN', values: farmerIds },
      { propertyName: 'hs_pipeline', operator: 'EQ', value: TICKET_PIPELINE_CS },
      { propertyName: 'hs_pipeline_stage', operator: 'IN', values: TICKET_STAGES_TRAMITACAO },
    ] }],
    [
      'subject', 'hs_pipeline_stage', 'data_de_realizacao_do_onboarding',
      'data_do_evento__ganho_', 'status_do_contrato', 'data_de_assinatura_do_contrato',
      'hubspot_owner_id',
    ],
  )

  const pendencias: Array<Pendencia & { dono: string }> = []

  for (const t of tickets) {
    const p = t.properties
    const dono = p.hubspot_owner_id ?? ''
    const onboarding = soData(p.data_de_realizacao_do_onboarding)
    const evento = soData(p.data_do_evento__ganho_)
    const statusContrato = p.status_do_contrato ?? null
    const assinado = statusContrato === 'Assinado'
    const eventoPassado = !!evento && evento < hoje

    const base = {
      dono,
      ticketId: t.id,
      assunto: p.subject ?? `Ticket ${t.id}`,
      etapa: ETAPAS_TICKET[p.hs_pipeline_stage ?? ''] ?? '',
      dataOnboarding: onboarding,
      dataEvento: evento,
      statusContrato,
      eventoPassado,
      hubspotUrl: urlTicket(t.id),
    }

    // O onboarding precisa ter acontecido — data futura é agendamento, não realização.
    if (onboarding && onboarding <= hoje) {
      if (!assinado) {
        const prazoMinuta = maisDiasUteis(onboarding, PRAZO_MINUTA_DIAS_UTEIS)
        pendencias.push({ ...base, tipo: 'minuta', prazo: prazoMinuta, diasParaPrazo: diasEntre(hoje, prazoMinuta) })

        // Cobrar assinatura no dia seguinte ao envio é ruído: só entra na reta final.
        const prazoAssinatura = maisDias(onboarding, PRAZO_ASSINATURA_DIAS)
        const diasParaAssinatura = diasEntre(hoje, prazoAssinatura)
        if (diasParaAssinatura <= ANTECEDENCIA_ASSINATURA_DIAS) {
          pendencias.push({ ...base, tipo: 'assinatura', prazo: prazoAssinatura, diasParaPrazo: diasParaAssinatura })
        }
      }
    }

    // Checklist entra em cena na antecedência combinada e vale até o evento.
    if (evento) {
      const prazoChecklist = maisDias(evento, -ANTECEDENCIA_CHECKLIST_DIAS)
      if (hoje >= prazoChecklist) {
        pendencias.push({ ...base, tipo: 'checklist', prazo: prazoChecklist, diasParaPrazo: diasEntre(hoje, prazoChecklist) })
      }
    }
  }

  // Mais urgente primeiro: vencidas há mais tempo no topo.
  pendencias.sort((a, b) => a.diasParaPrazo - b.diasParaPrazo || a.assunto.localeCompare(b.assunto))

  for (const farmerId of farmerIds) fora.set(farmerId, [])
  for (const { dono, ...p } of pendencias) {
    const lista = fora.get(dono)
    if (lista) lista.push(p)
  }
  return fora
}

export async function pendenciasDoFarmer(farmerId: string, hoje: string): Promise<Pendencia[]> {
  const porFarmer = await pendenciasDeVarios([farmerId], hoje)
  return porFarmer.get(farmerId) ?? []
}
