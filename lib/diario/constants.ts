import { FARMERS, TEAMS } from '../constants'

// ── Abordagens disponíveis no dropdown do plano do dia ──
export const ABORDAGENS = [
  'OFERTA PARA REATIVAÇÃO',
  'REUNIÃO DE RELACIONAMENTO',
  'AGENDAR PSA FIRST',
  'ABERTURA - BUSCAR OPORTUNIDADE',
  'PRIMEIRO CONTATO',
  'ACOMPANHAMENTO DE TRAMITAÇÃO',
  'CONTATO PÓS-EVENTO',
] as const

export type Abordagem = (typeof ABORDAGENS)[number]

// ── Resultado registrado no fechamento do dia ──
export const RESULTADOS = [
  { key: 'efetivo',     label: 'Contato efetivo',    cor: 'emerald' },
  { key: 'tentativa',   label: 'Tentei, sem sucesso', cor: 'amber'  },
  { key: 'nao_abordei', label: 'Não abordei',         cor: 'zinc'   },
] as const

export type Resultado = (typeof RESULTADOS)[number]['key']

/**
 * Toda empresa trabalhada precisa de observação, em qualquer resultado.
 * O mínimo de caracteres existe para evitar o "ok" e o "sem sucesso" que não
 * dizem nada a quem lê depois.
 */
export const MINIMO_OBSERVACAO = 50

/**
 * Com a atividade vindo do HubSpot, a tentativa já tem evidência lá (a ligação
 * e a disposição). Só pedimos texto onde o CRM não sabe: o que saiu da conversa
 * e por que a empresa ficou pra trás.
 */
export const RESULTADO_EXIGE_OBSERVACAO: Resultado[] = ['efetivo', 'nao_abordei']

// ── Baldes de sugestão, por tempo desde a última compra ──
export type Bucket = 'extra' | 'nutricao' | 'recompra' | 'reativacao' | 'primeiro_contato'

/**
 * Fronteiras em meses desde a última contratação. Mudar aqui muda a
 * classificação e o texto da página de ajuda ao mesmo tempo.
 */
export const LIMITE_MESES = { entreEventos: 3, nutricao: 8, recompra: 12 }

export const BUCKETS: Record<Bucket, { label: string; faixa: string; hint: string }> = {
  extra: {
    label: 'Entre eventos',
    faixa: `até ${LIMITE_MESES.entreEventos} meses`,
    hint: 'Comprou há pouco. A conversa aqui é o próximo evento do calendário, não uma nova venda do zero.',
  },
  nutricao: {
    label: 'Nutrição',
    faixa: `${LIMITE_MESES.entreEventos} a ${LIMITE_MESES.nutricao} meses`,
    hint: 'Cedo para recompra, tarde para pós-evento. Serve para manter a relação viva até a janela abrir.',
  },
  recompra: {
    label: 'Recompra',
    faixa: `${LIMITE_MESES.nutricao} a ${LIMITE_MESES.recompra} meses`,
    hint: 'Janela quente: a empresa está no ciclo de contratar de novo.',
  },
  reativacao: {
    label: 'Reativação',
    faixa: `mais de ${LIMITE_MESES.recompra} meses`,
    hint: 'Passou do ciclo. Precisa de um motivo novo para voltar à mesa.',
  },
  primeiro_contato: {
    label: 'Primeiro contato',
    faixa: 'nunca contratou',
    hint: 'Está na carteira mas nunca comprou. Entra quando os outros baldes não têm empresa suficiente.',
  },
}

// Ordem de exibição: o que é mais quente primeiro.
export const ORDEM_BUCKET: Record<Bucket, number> = {
  recompra: 0,
  nutricao: 1,
  reativacao: 2,
  extra: 3,
  primeiro_contato: 4,
}

/**
 * Princípio de Pareto: poucas quentes, muitas frias. Recompra, nutrição e
 * reativação dividem as 20 empresas do dia; "entre eventos" entra como extra,
 * fora da conta.
 */
export const COTA_DIARIA: Record<'recompra' | 'nutricao' | 'reativacao' | 'extra', number> = {
  recompra: 5,
  nutricao: 3,
  reativacao: 12,
  extra: 3,
}

export const EMPRESAS_DO_DIA = COTA_DIARIA.recompra + COTA_DIARIA.nutricao + COTA_DIARIA.reativacao

/**
 * Quantos dias a empresa descansa antes de voltar à lista, conforme o que
 * aconteceu na última vez que ela apareceu.
 */
export const COOLDOWN_POR_RESULTADO: Record<string, number> = {
  nao_abordei: 1,   // não foi tocada: volta amanhã, não pode evaporar
  tentativa: 3,     // ninguém fala com decisor na primeira ligação
  efetivo: 30,      // a conversa aconteceu; o follow-up vive no negócio, não aqui
}

/** Dia que ficou sem fechamento: trata como não abordada e volta amanhã. */
export const COOLDOWN_SEM_RESULTADO = 1

/**
 * Tentativas frustradas seguidas até a empresa pedir auxílio do líder. Três
 * "não atendeu" seguidos normalmente é dado ruim (telefone velho, contato saiu)
 * ou porta que não abre sozinha — não falta de esforço.
 *
 * A empresa NÃO sai do rodízio: continua na lista do farmer, marcada, e o líder
 * responde com uma orientação que aparece no próprio card.
 */
export const TENTATIVAS_ATE_AUXILIO = 3

// Abordagem sugerida por balde (o farmer pode trocar).
export const ABORDAGEM_PADRAO: Record<Bucket, Abordagem> = {
  extra: 'AGENDAR PSA FIRST',
  nutricao: 'REUNIÃO DE RELACIONAMENTO',
  recompra: 'REUNIÃO DE RELACIONAMENTO',
  reativacao: 'OFERTA PARA REATIVAÇÃO',
  primeiro_contato: 'PRIMEIRO CONTATO',
}

// ── Tickets ativos: eventos contratados em execução ──
export const TICKET_PIPELINE_CS = '748675953'
export const TICKET_STAGES_ATIVOS = [
  '1088360203', // Etapa de conferência
  '1088360204', // Iniciar Trâmites
  '1088360205', // Em andamento
  '1088361911', // Pagamento Pós-Palestra
  '1333136740', // Aguardando NF Palestrante
]

// Etapas de negócio ganho (mesmas do salão)
export const WON_STAGES = ['1076664462', '1076664460']

// ── Quem é quem ──
export interface Lider {
  id: string
  nome: string
  /** null = gerência: enxerga todos os times. */
  timeKey: keyof typeof TEAMS | null
}

export const LIDERES: Lider[] = [
  // Líderes de time: cada um vê só a própria formação
  { id: '80454607', nome: 'Letícia Silva dos Santos', timeKey: 'leticia' },
  { id: '80454582', nome: 'Katyeli Ceroni Madril',    timeKey: 'katyeli' },
  { id: '81035544', nome: 'Camila Fay',               timeKey: 'camila'  },
  { id: '80454577', nome: 'Daniel Bento Sias',        timeKey: 'dani'    },
  // Gerência: vê todos os farmers dos quatro times
  { id: '80454585', nome: 'Leandro Bengochea',        timeKey: null      },
  { id: '80436289', nome: 'Márcio Spagnolo',          timeKey: null      },
  { id: '86256444', nome: 'Ana Machado',              timeKey: null      }, // owner cadastrado como "Ana Carolina Vaz"
]

export type Papel = 'farmer' | 'lider'

export interface Usuario {
  id: string
  nome: string
  papel: Papel
  timeKey: string | null
}

/**
 * Farmers que não usam o diário, mesmo constando na formação de `lib/constants.ts`.
 * Fica aqui para não mexer nos outros dashboards, que dependem daquela lista.
 */
/**
 * Quem tem conta duplicada no HubSpot: no diário vale a conta que realmente
 * detém a carteira e faz o login, não a canônica usada no histórico de negócios.
 */
export const CONTA_DO_DIARIO: Record<string, string> = {
  '85002282': '93238814', // Sotoriva: carteira e login vivem na conta nova
}

/** Resolve a conta antiga para a que vale no diário. */
export function contaDoDiario(id: string): string {
  return CONTA_DO_DIARIO[id] ?? id
}

export const FORA_DO_DIARIO = new Set<string>([
  // quem sai da empresa é removido da formação em lib/constants.ts;
  // esta lista é para quem continua no time mas não usa o diário
])

/** Farmers de um líder, na formação vigente. Líder sem time vê todos. */
export function farmersDoLider(timeKey: string | null): string[] {
  const normaliza = (ids: string[]) => {
    const fora: string[] = []
    for (const bruto of ids) {
      const id = contaDoDiario(bruto)
      if (FORA_DO_DIARIO.has(id) || fora.includes(id)) continue
      fora.push(id)
    }
    return fora
  }
  if (!timeKey) return normaliza(Object.values(TEAMS).flatMap((t) => t.farmerIds))
  return normaliza(TEAMS[timeKey]?.farmerIds ?? [])
}

/** Todos os farmers em operação hoje, na ordem dos times. */
export function farmersAtivos(): Array<{ id: string; nome: string; timeKey: string; timeLabel: string }> {
  const out: Array<{ id: string; nome: string; timeKey: string; timeLabel: string }> = []
  for (const [timeKey, time] of Object.entries(TEAMS)) {
    for (const bruto of time.farmerIds) {
      // conta duplicada vira uma só: a que detém a carteira
      const id = contaDoDiario(bruto)
      if (FORA_DO_DIARIO.has(id)) continue
      if (out.some((f) => f.id === id)) continue
      out.push({ id, nome: FARMERS[id] ?? id, timeKey, timeLabel: time.label })
    }
  }
  return out
}

export function usuarioPorId(id: string): Usuario | null {
  const lider = LIDERES.find((l) => l.id === id)
  if (lider) return { id: lider.id, nome: lider.nome, papel: 'lider', timeKey: lider.timeKey }
  const farmer = farmersAtivos().find((f) => f.id === id)
  if (farmer) return { id: farmer.id, nome: farmer.nome, papel: 'farmer', timeKey: farmer.timeKey }
  return null
}

// ── Tramitações: pendências dos tickets de CS ──

export type TipoTramitacao = 'minuta' | 'assinatura' | 'checklist'

export const TRAMITACOES: Record<TipoTramitacao, {
  label: string
  acao: string
  prazo: string
  entra: string
  baixa: 'dupla_checagem' | 'crm'
}> = {
  minuta: {
    label: 'Enviar minuta contratual',
    acao: 'Enviar o contrato para o cliente',
    prazo: '1 dia útil após o onboarding',
    entra: 'assim que o onboarding acontece',
    baixa: 'dupla_checagem',
  },
  assinatura: {
    label: 'Assinatura do contrato',
    acao: 'Cobrar a assinatura',
    prazo: '20 dias após o onboarding',
    entra: 'faltando 5 dias para o prazo',
    baixa: 'crm', // status_do_contrato = Assinado
  },
  checklist: {
    label: 'Checklist do evento',
    acao: 'Fazer e enviar o checklist',
    prazo: '2 dias antes do evento',
    entra: 'na data do prazo',
    baixa: 'dupla_checagem',
  },
}

/** Prazos, em dias, a partir da data que dispara cada pendência. */
export const PRAZO_MINUTA_DIAS_UTEIS = 1
export const PRAZO_ASSINATURA_DIAS = 20

/**
 * A cobrança de assinatura só entra na lista quando falta pouco para o prazo.
 * Antes disso o contrato acabou de ser enviado e não há o que cobrar.
 */
export const ANTECEDENCIA_ASSINATURA_DIAS = 5
export const ANTECEDENCIA_CHECKLIST_DIAS = 2

/** Resultado registrado no fim do dia em cada tramitação trabalhada. */
export const RESULTADOS_TRAMITACAO = [
  { key: 'resolvi',  label: 'Resolvi',  cor: 'emerald' },
  { key: 'avancei',  label: 'Avancei',  cor: 'blue'    },
  { key: 'travado',  label: 'Travado',  cor: 'amber'   },
] as const

export type ResultadoTramitacao = (typeof RESULTADOS_TRAMITACAO)[number]['key']

/** "Travado" exige explicação: é o que vira pedido de ajuda ao líder. */
export const RESULTADO_TRAMITACAO_EXIGE_OBSERVACAO: ResultadoTramitacao[] = ['travado']

export const ETAPAS_TICKET: Record<string, string> = {
  '1088360203': 'Etapa de conferência',
  '1088360204': 'Iniciar trâmites',
  '1088360205': 'Em andamento',
  '1088361911': 'Pagamento pós-palestra',
  '1333136740': 'Aguardando NF palestrante',
}
