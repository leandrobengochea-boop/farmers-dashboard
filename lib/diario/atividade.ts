import { FORCA_RESULTADO } from './constants'
import { searchAllPages } from './carteira'
import { conversaRespondida, disposicoesEfetivas, porEmpresa } from './conversas'
import { ItemDiario, atualizaItem, briefing, itensDoDia, ultimoDiaComLista } from './db'

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
  respondidas: number         // conversas de WhatsApp em que o cliente respondeu
  texto: string               // anotação mais recente, já sem HTML
  resultadoSugerido: 'efetivo' | 'tentativa' | null
}

function semHtml(valor: string): string {
  return valor.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
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
      a = { ligacoes: 0, conectadas: 0, reunioes: 0, outras: 0, mensagens: 0, respondidas: 0, texto: '', resultadoSugerido: null }
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
    const respondeu = conversaRespondida(c.properties.hs_communication_body ?? '')
    for (const empresa of empMensagens.get(c.id) ?? []) {
      const a = registra(c.properties.hubspot_owner_id ?? '', empresa)
      if (!a) continue
      a.mensagens++
      if (respondeu) a.respondidas++
    }
  }

  for (const mapa of porFarmer.values()) {
    for (const a of mapa.values()) {
      // Conversa de WhatsApp conta como efetivo quando o cliente respondeu —
      // é isso que o alinhamento dos blocos do corpo diz. Mensagem que só saiu
      // daqui continua sendo tentativa: ninguém falou com ninguém.
      if (a.conectadas > 0 || a.reunioes > 0 || a.respondidas > 0) a.resultadoSugerido = 'efetivo'
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
  opcoes: { revisado?: boolean } = {},
): Promise<void> {
  // Dia revisado está fechado: o líder já olhou, nada muda sozinho depois.
  if (opcoes.revisado) return

  for (const item of itens) {
    const a = atividade.get(item.companyId)
    if (!a?.resultadoSugerido) continue

    // Sobe na escala, nunca desce. O CRM vê a ligação conectada que o farmer
    // ainda não registrou; o farmer vê a conversa que não passou pelo CRM —
    // nos dados de set/out, 144 linhas seriam REBAIXADAS por engano contra 18
    // que mereciam subir. Edição do líder também não é desfeita por automação.
    const forcaAtual = FORCA_RESULTADO[item.resultado ?? ''] ?? 0
    const forcaNova = FORCA_RESULTADO[a.resultadoSugerido] ?? 0
    const foraDaEscala = !!item.resultado && forcaAtual === 0
    const preencheResultado = !foraDaEscala && !item.editadoPor && forcaNova > forcaAtual

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

/**
 * Fecha o dia anterior com o que o HubSpot registrou depois que o farmer saiu.
 *
 * A lista de hoje é montada a partir do resultado dos dias passados, e esse
 * resultado chega atrasado: a ligação de ontem às 18h só vira "contato efetivo"
 * quando alguém reabre a tela. Sem isso, a empresa que foi atendida ontem volta
 * hoje como se não tivesse sido abordada — foi o que aconteceu com a TRE-GO,
 * cuja lista de 20/10 nasceu 17 minutos antes do resultado de 19/10 ser gravado.
 */
export async function completaDiaAnterior(farmerId: string, hoje: string): Promise<void> {
  const dia = await ultimoDiaComLista(farmerId, hoje)
  if (!dia) return
  const [itens, brief] = await Promise.all([itensDoDia(farmerId, dia), briefing(farmerId, dia)])
  if (itens.length === 0 || brief.status === 'revisado') return
  if (itens.every((i) => i.resultado)) return

  const atividade = await atividadeDoDia(farmerId, dia)
  if (atividade.size === 0) return
  await aplicaAtividade(farmerId, dia, itens, atividade)
}
