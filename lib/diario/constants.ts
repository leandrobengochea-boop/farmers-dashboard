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

// ── Baldes de sugestão, por tempo desde a última compra ──
// A janela de 3 a 8 meses fica de fora de propósito: é período de nutrição,
// cedo demais para recompra e recente demais para reativação.
export type Bucket = 'extra' | 'recompra' | 'reativacao' | 'primeiro_contato'

export const BUCKETS: Record<Bucket, { label: string; hint: string; minMeses: number | null; maxMeses: number | null }> = {
  extra:            { label: 'Entre eventos',  hint: 'Comprou há pouco — sugerir o próximo evento do calendário', minMeses: 0,    maxMeses: 3 },
  recompra:         { label: 'Recompra',       hint: 'Janela quente: 8 a 12 meses desde a última contratação',    minMeses: 8,    maxMeses: 12 },
  reativacao:       { label: 'Reativação',     hint: 'Mais de 12 meses sem contratar',                             minMeses: 12,   maxMeses: null },
  primeiro_contato: { label: 'Primeiro contato', hint: 'Sem histórico de contratação na carteira',                 minMeses: null, maxMeses: null },
}

// Ordem de exibição: o que é mais quente primeiro.
export const ORDEM_BUCKET: Record<Bucket, number> = {
  recompra: 0,
  reativacao: 1,
  extra: 2,
  primeiro_contato: 3,
}

// Princípio de Pareto: poucas quentes, muitas frias.
export const COTA_DIARIA: Record<'recompra' | 'reativacao' | 'extra', number> = {
  recompra: 5,
  reativacao: 15,
  extra: 3,
}

// Empresa sugerida não volta a aparecer por este número de dias corridos.
// Sem isso o farmer receberia a mesma lista toda semana: a carteira elegível
// média (~90 empresas com histórico) é varrida em cerca de 5 dias úteis.
export const COOLDOWN_DIAS = 15

// Abordagem sugerida por balde (o farmer pode trocar).
export const ABORDAGEM_PADRAO: Record<Bucket, Abordagem> = {
  extra: 'AGENDAR PSA FIRST',
  recompra: 'REUNIÃO DE RELACIONAMENTO',
  reativacao: 'OFERTA PARA REATIVAÇÃO',
  primeiro_contato: 'PRIMEIRO CONTATO',
}

// ── Tickets ativos: eventos contratados em execução ──
// Pipeline "CS" (748675953). Etapas marcadas como OPEN no HubSpot.
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
    return Object.values(TEAMS).flatMap((t) => t.farmerIds)
  }
  return TEAMS[timeKey]?.farmerIds ?? []
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
