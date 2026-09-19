import { HUBSPOT_PORTAL_ID } from '../constants'
import {
  ANTECEDENCIA_CHECKLIST_DIAS, ETAPAS_TICKET, PRAZO_ASSINATURA_DIAS, PRAZO_MINUTA_DIAS_UTEIS,
  TICKET_PIPELINE_CS, TICKET_STAGES_ATIVOS, TipoTramitacao,
} from './constants'
import { searchAllPages } from './carteira'

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
 * - assinatura: mesma origem, vence em 20 dias — baixa sozinha pelo CRM
 * - checklist: nasce 2 dias antes do evento
 *
 * Contrato assinado baixa tanto a assinatura quanto o envio da minuta: se foi
 * assinado, foi enviado.
 */
export async function pendenciasDoFarmer(farmerId: string, hoje: string): Promise<Pendencia[]> {
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  const tickets = await searchAllPages(
    pat,
    'tickets',
    [{ filters: [
      { propertyName: 'hubspot_owner_id', operator: 'EQ', value: farmerId },
      { propertyName: 'hs_pipeline', operator: 'EQ', value: TICKET_PIPELINE_CS },
      { propertyName: 'hs_pipeline_stage', operator: 'IN', values: TICKET_STAGES_ATIVOS },
    ] }],
    [
      'subject', 'hs_pipeline_stage', 'data_de_realizacao_do_onboarding',
      'data_do_evento__ganho_', 'status_do_contrato', 'data_de_assinatura_do_contrato',
    ],
  )

  const pendencias: Pendencia[] = []

  for (const t of tickets) {
    const p = t.properties
    const onboarding = soData(p.data_de_realizacao_do_onboarding)
    const evento = soData(p.data_do_evento__ganho_)
    const statusContrato = p.status_do_contrato ?? null
    const assinado = statusContrato === 'Assinado'
    const eventoPassado = !!evento && evento < hoje

    const base = {
      ticketId: t.id,
      assunto: p.subject ?? `Ticket ${t.id}`,
      etapa: ETAPAS_TICKET[p.hs_pipeline_stage ?? ''] ?? '',
      dataOnboarding: onboarding,
      dataEvento: evento,
      statusContrato,
      eventoPassado,
      hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-5/${t.id}`,
    }

    // O onboarding precisa ter acontecido — data futura é agendamento, não realização.
    if (onboarding && onboarding <= hoje) {
      if (!assinado) {
        const prazoMinuta = maisDiasUteis(onboarding, PRAZO_MINUTA_DIAS_UTEIS)
        pendencias.push({ ...base, tipo: 'minuta', prazo: prazoMinuta, diasParaPrazo: diasEntre(hoje, prazoMinuta) })

        const prazoAssinatura = maisDias(onboarding, PRAZO_ASSINATURA_DIAS)
        pendencias.push({ ...base, tipo: 'assinatura', prazo: prazoAssinatura, diasParaPrazo: diasEntre(hoje, prazoAssinatura) })
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
  return pendencias.sort((a, b) => a.diasParaPrazo - b.diasParaPrazo || a.assunto.localeCompare(b.assunto))
}
