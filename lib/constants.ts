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
  '94028856': 'Andrei Felippe',
  '94316537': 'Maria Julia',
  '94316538': 'Gabriel Alves',
}

// Maps old/extra farmer IDs to their canonical ID so deals are merged in analytics
export const FARMER_ALIASES: Record<string, string> = {
  '93238814': '85002282',  // Sotoriva nova conta → ID canônico
}

// Per-farmer date restrictions applied after fetching
// fromDate: ignore deals before this date (YYYY-MM-DD)
// untilDate: ignore deals from this date onwards — keeps history, removes future
export const FARMER_DATE_RESTRICTIONS: Record<string, { fromDate?: string; untilDate?: string }> = {
  '81033487': { fromDate: '2026-03-01' },  // Gustavo: entra em março/26
  '84497577': { fromDate: '2026-03-01' },  // Vitória: entra em março/26
  '88200222': { untilDate: '2026-06-01' }, // Kennedy: saiu em junho/26
  '87371619': { untilDate: '2026-06-01' }, // Maryna: saiu em junho/26
}

export const HUBSPOT_PORTAL_ID = '49656171'

export const TEAMS: Record<string, { label: string; farmerIds: string[] }> = {
  leticia: {
    label: 'Time Leticia',
    farmerIds: ['89632494', '87159365', '88200239', '86256444', '84015882', '94028856', '94316538'],
  },
  katyeli: {
    label: 'Time Katyeli',
    farmerIds: ['85002282', '93238814', '84497577', '85002012', '85846972', '93599591', '79760745', '80228367'],
  },
  dani: {
    label: 'Time Dani',
    farmerIds: ['92333469', '85846971', '82410958', '81033487', '92335488', '89632472', '94316537'],
  },
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
