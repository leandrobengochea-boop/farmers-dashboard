export const FARMERS: Record<string, string> = {
  '87159365': 'João Lucas',
  '88200239': 'Luiza',
  '79760745': 'Thiago',
  '86256444': 'Ana Carolina',
  '84497577': 'Vitória',
  '85002012': 'Bruna Machado',
  '85002282': 'Sotoriva',
  '93238814': 'Sotoriva',   // conta nova — alias para 85002282
  '85846972': 'Daniela',
  '85846971': 'Lenz',
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
}

// Maps old/extra farmer IDs to their canonical ID so deals are merged in analytics
export const FARMER_ALIASES: Record<string, string> = {
  '93238814': '85002282',  // Sotoriva nova conta → ID canônico
}

// Per-farmer date restrictions applied after fetching
// fromDate: ignore deals before this date (YYYY-MM-DD)
// untilDate: ignore deals from this date onwards — keeps history, removes future
export const FARMER_DATE_RESTRICTIONS: Record<string, { fromDate?: string; untilDate?: string }> = {
  '81033487': { fromDate: '2026-04-01' },  // Gustavo: entra em abril/26 (março era transição)
  '84497577': { fromDate: '2026-03-01' },  // Vitória: entra em março/26
  '88200222': { untilDate: '2026-06-01' }, // Kennedy: saiu em junho/26
  '87371619': { untilDate: '2026-06-01' }, // Maryna: saiu em junho/26
  '87159365': { untilDate: '2026-07-01' }, // João Lucas: fora da formação nova (jul/26)
  '86256444': { untilDate: '2026-07-01' }, // Ana Carolina: fora da formação nova (jul/26)
  '89632494': { untilDate: '2026-07-01' }, // Willker: fora da formação nova (jul/26)
  '82410958': { untilDate: '2026-07-01' }, // Maria Eduarda (conta antiga arquivada)
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
export const B2C_CLOSER_NAMES = ['mayda', 'joão araújo', 'joao araujo', 'amanda de oliveira', 'willker', 'gabrielly']

export function isB2CCloser(ownerName: string): boolean {
  const lower = ownerName.toLowerCase()
  return B2C_CLOSER_NAMES.some((n) => lower.includes(n))
}

// Funis B2C: cada oportunidade é uma demanda única (pessoa/negócio individual),
// então NÃO deduplica por empresa — mesmo que tenha (ou não tenha) empresa.
export const B2C_PIPELINE_IDS = new Set(['725182862', '727938450', '904543067'])

// Chave de "empresa/demanda única" usada em todas as contagens de empresas únicas:
// - B2C: sempre única (usa o id do negócio)
// - B2B com empresa: deduplica pela empresa
// - sem empresa: conta como única (usa o id do negócio)
export function uniqueDemandKey(deal: { id: string; pipeline: string; companyId: string }): string {
  if (B2C_PIPELINE_IDS.has(deal.pipeline)) return `deal:${deal.id}`
  return deal.companyId || `deal:${deal.id}`
}

type TeamMap = Record<string, { label: string; farmerIds: string[] }>

// Data de virada das formações. Negócios com data < TEAM_CUTOVER usam a
// formação antiga (TEAMS_BEFORE); a partir dela, a nova (TEAMS_FROM).
export const TEAM_CUTOVER = '2026-07-01'

// Formação até 30/06/2026 (preserva a leitura histórica por time)
export const TEAMS_BEFORE: TeamMap = {
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

// Formação a partir de 01/07/2026 (imagem das squads novas)
export const TEAMS_FROM: TeamMap = {
  leticia: {
    label: 'Time Leticia',
    // Bruna Machado, Gustavo, Gabriel Alves, Luiza, Amanda, Felippe
    farmerIds: ['85002012', '81033487', '94316538', '88200239', '84015882', '94028856', '94891358'],
  },
  dani: {
    label: 'Time Dani',
    // Vitória, Rafael, Thaina, Lenz, Gabriela Charlier, Maria Julia, Julia
    farmerIds: ['84497577', '92333469', '92335488', '85846971', '94399135', '94316537', '95283516'],
  },
  katyeli: {
    label: 'Time Katy',
    // Sotoriva, Maria Eduarda Porto, Thiago, Daniela, Bruna Saraiva, Jhuly
    farmerIds: ['85002282', '93238814', '89632472', '79760745', '85846972', '93599591', '80228367'],
  },
}

// Fonte de rótulos / botões de time (3 times, chaves estáveis)
export const TEAMS: TeamMap = TEAMS_FROM

// Verifica se um negócio (farmer + data) pertence ao time, respeitando a
// virada de formação: < TEAM_CUTOVER usa a formação antiga, >= usa a nova.
export function dealInTeam(farmerId: string, dateIso: string, teamId: string): boolean {
  const cutover = new Date(TEAM_CUTOVER).getTime()
  const ts = dateIso ? new Date(dateIso).getTime() : 0
  const map = ts >= cutover ? TEAMS_FROM : TEAMS_BEFORE
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
