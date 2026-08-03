export const FARMERS: Record<string, string> = {
  '87159365': 'João Backmann',
  '88200239': 'Luiza',
  '79760745': 'Thiago',
  '86256444': 'Ana Carolina',
  '84497577': 'Vitória',
  '85002012': 'Bruna Machado',
  '85002282': 'Sotoriva',
  '93238814': 'Sotoriva',   // conta nova — alias para 85002282
  '85846972': 'Daniela',
  '85846971': 'Francielle Teles',
  '81033487': 'Gustavo',
  '88200222': 'Kennedy',
  '87371619': 'Maryna',
  '84015882': 'Amanda',
  '89632494': 'Willker',
  '82410958': 'Maria Eduarda',
  '92333469': 'Rafael',
  '92335488': 'Thaina',
  '93599591': 'Bruna Saraiva',
  '89632472': 'Maria Eduarda Porto',
  '80228367': 'Jhuly',
  '94028856': 'Felippe',
  '94316537': 'Maria Julia',
  '94316538': 'Gabriel Alves',
  '94399135': 'Gabriela',
  '94891358': 'Priscila',
  '95283516': 'Julia',
  '95415669': 'Gisele Santos',
  '95810969': 'Rhayssa',
  '95993082': 'Hans Lopes',
  '93357687': 'Nathalia',
  '95811085': 'Wagner',
  '96198720': 'Alexcia',
  '84249251': 'Tércio',
  '80688884': 'Rafael Brack',
  '96198838': 'Leonardo Gomes',
}

// Maps old/extra farmer IDs to their canonical ID so deals are merged in analytics
export const FARMER_ALIASES: Record<string, string> = {
  '93238814': '85002282',  // Sotoriva nova conta → ID canônico
}

// Overrides pontuais: deal IDs que devem ser forçados para um farmer específico
// (erro de cadastro no HubSpot que não pode ser corrigido lá)
export const DEAL_FARMER_OVERRIDES: Record<string, string> = {
  '62654660376': '85002012', // Mayra | Credipronto → Bruna Machado (farmer original errado)
}

// Deals que devem ignorar o filtro de origem (erro de cadastro no HubSpot)
export const ORIGIN_OVERRIDE_DEAL_IDS = new Set([
  '62654660376', // Mayra | Credipronto — Bruna Machado (inbound, deveria ser Farmer)
  '63187333523', // Gabriela | FDC — Maria Julia (inbound, deveria ser Farmer)
])

// Per-farmer date restrictions applied after fetching
// fromDate: ignore deals before this date (YYYY-MM-DD)
// untilDate: ignore deals from this date onwards — keeps history, removes future
export const FARMER_DATE_RESTRICTIONS: Record<string, { fromDate?: string; untilDate?: string }> = {
  '81033487': { fromDate: '2026-04-01' },  // Gustavo: entra em abril/26 (março era transição)
  '84497577': { fromDate: '2026-03-01' },  // Vitória: entra em março/26
  '88200222': { untilDate: '2026-06-01' }, // Kennedy: saiu em junho/26
  '87371619': { untilDate: '2026-06-01' }, // Maryna: saiu em junho/26
  '86256444': { untilDate: '2026-07-01' }, // Ana Carolina: fora da formação nova (jul/26)
  '89632494': { untilDate: '2026-07-01' }, // Willker: fora da formação nova (jul/26)
  '82410958': { untilDate: '2026-07-01' }, // Maria Eduarda (conta antiga arquivada)
  '88200239': { untilDate: '2026-08-01' }, // Luiza: fora da formação ago/26
  '84015882': { untilDate: '2026-08-01' }, // Amanda: fora da formação ago/26
  '94316538': { untilDate: '2026-08-01' }, // Gabriel Alves: fora da formação ago/26
  '94399135': { untilDate: '2026-08-01' }, // Gabriela Charlier: fora da formação ago/26
  '95283516': { untilDate: '2026-08-01' }, // Julia: fora da formação ago/26
  '85846972': { untilDate: '2026-08-01' }, // Daniela: fora da formação ago/26
  '92333469': { untilDate: '2026-08-01' }, // Rafael: fora da formação ago/26 (era seller)
}

// ── Filtro de origem do lead (vale apenas de ORIGIN_CUTOVER em diante) ──
// De julho/26 pra frente, só contam no resultado do farmer os leads com
// origem_do_lead na allowlist OU origem_da_qualificacao = Farmer.
// Histórico (antes do cutover) mantém todos os leads.
export const ORIGIN_CUTOVER = '2026-07-01'
export const ALLOWED_ORIGEM_DO_LEAD = ['Ação de CRM', 'Carteira do Farmer']
export const ALLOWED_ORIGEM_QUALIFICACAO = ['Farmer']

export const HUBSPOT_PORTAL_ID = '49656171'

// Closers B2C — negócios cujo curador (owner) é um desses nomes
// foram encaminhados ao time B2C. Match por substring case-insensitive.
export const B2C_CLOSER_NAMES = ['mayda', 'joão araújo', 'joao araujo', 'amanda de oliveira', 'willker', 'gabrielly', 'luiza rodriguez', 'camila fay', 'tercio']

export function isB2CCloser(ownerName: string): boolean {
  const lower = ownerName.toLowerCase()
  return B2C_CLOSER_NAMES.some((n) => lower.includes(n))
}

// Farmers que viraram vendedores — deals com eles não contam como estagnados
const SELLER_FARMER_IDS = new Set(['92333469', '94316538']) // Rafael, Gabriel Alves

export function isDealWithCreator(farmerId: string, ownerId: string): boolean {
  if (!ownerId) return false
  if (SELLER_FARMER_IDS.has(farmerId)) return false
  const canonicalOwner = FARMER_ALIASES[ownerId] ?? ownerId
  return canonicalOwner === farmerId
}

// Funis B2C: cada oportunidade é uma demanda única (pessoa/negócio individual),
// então NÃO deduplica por empresa — mesmo que tenha (ou não tenha) empresa.
export const B2C_PIPELINE_IDS = new Set(['725182862', '727938450', '904543067'])

// Chave de "empresa/demanda única" usada em todas as contagens de empresas únicas:
// - B2C: sempre única (usa o id do negócio)
// - B2B com empresa: deduplica pela empresa
// - sem empresa: conta como única (usa o id do negócio)
export function uniqueDemandKey(deal: { id: string; pipeline: string; companyId: string; farmerId?: string }): string {
  const prefix = deal.farmerId ? `${deal.farmerId}:` : ''
  if (B2C_PIPELINE_IDS.has(deal.pipeline)) return `${prefix}deal:${deal.id}`
  return `${prefix}${deal.companyId || `deal:${deal.id}`}`
}

type TeamMap = Record<string, { label: string; farmerIds: string[] }>

// Formação até 30/06/2026
const TEAMS_BEFORE: TeamMap = {
  leticia: {
    label: 'Time Leticia',
    farmerIds: ['89632494', '87159365', '88200239', '86256444', '84015882', '94028856', '94316538'],
  },
  katyeli: {
    label: 'Time Katy',
    farmerIds: ['85002282', '93238814', '84497577', '85002012', '85846972', '93599591', '79760745', '80228367'],
  },
  dani: {
    label: 'Time Dani',
    farmerIds: ['92333469', '85846971', '82410958', '81033487', '92335488', '89632472', '94316537'],
  },
}

// Formação julho/2026
const TEAMS_JULY: TeamMap = {
  leticia: {
    label: 'Time Leticia',
    farmerIds: ['85002012', '81033487', '94316538', '88200239', '84015882', '94028856', '94891358', '95415669', '95810969', '95993082'],
  },
  dani: {
    label: 'Time Dani',
    farmerIds: ['84497577', '92333469', '92335488', '85846971', '94399135', '94316537', '95283516', '87159365'],
  },
  katyeli: {
    label: 'Time Katy',
    farmerIds: ['85002282', '93238814', '89632472', '79760745', '85846972', '93599591', '80228367'],
  },
}

// Formação a partir de agosto/2026
const TEAMS_AUG: TeamMap = {
  leticia: {
    label: 'Time Leticia',
    farmerIds: ['95810969', '93357687', '85002282', '93238814', '94316537', '94028856', '81033487'],
  },
  dani: {
    label: 'Time Dani',
    farmerIds: ['94891358', '95993082', '80688884', '92335488', '95811085', '79760745'],
  },
  katyeli: {
    label: 'Time Katy',
    farmerIds: ['95415669', '85846971', '93599591', '87159365', '89632472'],
  },
  camila: {
    label: 'Time Cami',
    farmerIds: ['96198720', '96198838', '80228367', '84497577', '85002012', '84249251'],
  },
}

const TEAM_PERIODS: { from: number; teams: TeamMap }[] = [
  { from: new Date('2026-08-01').getTime(), teams: TEAMS_AUG },
  { from: new Date('2026-07-01').getTime(), teams: TEAMS_JULY },
]

export const TEAMS: TeamMap = TEAMS_AUG

// Metas mensais de empresas únicas, por mês de vigência (mais recente primeiro).
// Andam junto com a formação: jun e jul/26 tinham 3 times, ago/26 tem 4.
const GOAL_PERIODS: { from: string; total: number; perTeam: number }[] = [
  { from: '2026-08', total: 480, perTeam: 120 }, // 4 times
  { from: '2026-07', total: 336, perTeam: 112 }, // 3 times
  { from: '2026-06', total: 300, perTeam: 100 }, // 3 times
]
// Meses anteriores a jun/26 herdam a meta de junho.
const GOAL_BEFORE = { total: 300, perTeam: 100 }

/** Meta do mês (YYYY-MM). `perTeam` quando há um time selecionado. */
export function monthlyGoal(monthKey: string, perTeam: boolean): number {
  const period = GOAL_PERIODS.find((p) => monthKey >= p.from) ?? GOAL_BEFORE
  return perTeam ? period.perTeam : period.total
}

export function dealInTeam(farmerId: string, dateIso: string, teamId: string): boolean {
  const ts = dateIso ? new Date(dateIso).getTime() : 0
  let map: TeamMap = TEAMS_BEFORE
  for (const period of TEAM_PERIODS) {
    if (ts >= period.from) { map = period.teams; break }
  }
  const team = map[teamId]
  return team ? team.farmerIds.includes(farmerId) : false
}

export const CRITERIA: Array<{ key: string; label: string; weight: number }> = [
  { key: 'reuniao_agendada', label: 'Reunião agendada', weight: 3 },
  { key: 'tempo_de_compra_45_dias', label: 'Tempo de compra 45 dias', weight: 3 },
  { key: 'data_do_evento_ate_6_meses', label: 'Data do evento até 6 meses', weight: 2 },
  { key: 'historico_de_contratacao', label: 'Histórico de contratação', weight: 2 },
  { key: 'qualificacao_completa', label: 'Qualificação completa', weight: 1 },
  { key: 'faixa_de_investimento_informada', label: 'Faixa de investimento', weight: 1 },
]

export const MAX_SCORE = 12
