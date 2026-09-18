import { FARMERS, FARMER_ALIASES, TEAMS } from '../constants'

// ── Abordagens disponíveis no dropdown do plano do dia ──
export const ABORDAGENS = [
  'OFERTA PARA REATIVAÇÃO',
  'REUNIÃO DE RELACIONAMENTO',
  'AGENDAR PSA FIRST',
  'ABERTURA - BUSCAR OPORTUNIDADE',
  'PRIMEIRO CONTATO',
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
 * Onde a observação de resultado é obrigatória: quando houve conversa (o que
 * saiu dela) e quando a empresa ficou pra trás (por quê). "Tentei, sem sucesso"
 * se explica sozinho.
 */
export const RESULTADO_EXIGE_OBSERVACAO: Resultado[] = ['efetivo', 'nao_abordei']

// ── Baldes de sugestão, por tempo desde a última compra ──
export type Bucket = 'extra' | 'nutricao' | 'recompra' | 'reativacao' | 'primeiro_contato'

export const BUCKETS: Record<Bucket, { label: string; hint: string }> = {
  extra:            { label: 'Entre eventos',   hint: 'Comprou há menos de 3 meses — sugerir o próximo evento do calendário' },
  nutricao:         { label: 'Nutrição',        hint: '3 a 8 meses desde a última contratação' },
  recompra:         { label: 'Recompra',        hint: 'Janela quente: 8 a 12 meses desde a última contratação' },
  reativacao:       { label: 'Reativação',      hint: 'Mais de 12 meses sem contratar' },
  primeiro_contato: { label: 'Primeiro contato', hint: 'Sem histórico de contratação na carteira' },
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
  timeKey: keyof typeof TEAMS | null // null = vê todos os times
}

export const LIDERES: Lider[] = [
  { id: '80454607', nome: 'Letícia Silva dos Santos', timeKey: 'leticia' },
  { id: '80454582', nome: 'Katyeli Ceroni Madril',    timeKey: 'katyeli' },
  { id: '81035544', nome: 'Camila Fay',               timeKey: 'camila'  },
  { id: '80454577', nome: 'Daniel Bento Sias',        timeKey: 'dani'    },
  { id: '80454585', nome: 'Leandro Bengochea',        timeKey: null      },
]

export type Papel = 'farmer' | 'lider'

export interface Usuario {
  id: string
  nome: string
  papel: Papel
  timeKey: string | null
}

/** Farmers de um líder, na formação vigente. Líder sem time vê todos. */
export function farmersDoLider(timeKey: string | null): string[] {
  if (!timeKey) {
    return Object.values(TEAMS).flatMap((t) => t.farmerIds).filter((id) => !FARMER_ALIASES[id])
  }
  return (TEAMS[timeKey]?.farmerIds ?? []).filter((id) => !FARMER_ALIASES[id])
}

/** Todos os farmers em operação hoje, na ordem dos times. */
export function farmersAtivos(): Array<{ id: string; nome: string; timeKey: string; timeLabel: string }> {
  const out: Array<{ id: string; nome: string; timeKey: string; timeLabel: string }> = []
  for (const [timeKey, time] of Object.entries(TEAMS)) {
    for (const id of time.farmerIds) {
      // contas duplicadas (alias) não viram um segundo farmer na lista
      if (FARMER_ALIASES[id]) continue
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
