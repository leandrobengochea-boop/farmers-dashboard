export const FARMERS: Record<string, string> = {
  '87159365': 'João Lucas',
  '88200239': 'Luiza',
  '79760745': 'Thiago',
  '86256444': 'Ana Carolina',
  '84497577': 'Vitória',
  '85002012': 'Bruna Machado',
  '85002282': 'Sotoriva',
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
}

export const HUBSPOT_PORTAL_ID = '49656171'

export const TEAMS: Record<string, { label: string; farmerIds: string[] }> = {
  leticia: {
    label: 'Time Leticia',
    farmerIds: ['89632494', '87159365', '88200239', '86256444', '84015882'],
  },
  katyeli: {
    label: 'Time Katyeli',
    farmerIds: ['85002282', '84497577', '85002012', '85846972', '93599591', '79760745'],
  },
  dani: {
    label: 'Time Dani',
    farmerIds: ['92333469', '85846971', '82410958', '81033487', '92335488', '89632472'],
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
