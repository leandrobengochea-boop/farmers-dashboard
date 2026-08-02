// Paleta dos gráficos. Todos os valores aqui passaram pelo validador de
// data-viz contra a superfície real dos cards (zinc-800, #27272a) em dark.
// Não editar no olho — qualquer troca precisa rodar o validador de novo.

export const CHART_SURFACE = '#27272a'

// ── Rampa ordinal de pontuação (nota 6 → 12) ────────────────────────────────
// Magnitude pede uma cor só, clara→escura. A rampa anterior era um arco-íris
// (127° de espectro): as notas 7 e 8 ficavam a ΔL 0.032 uma da outra, e a nota
// 12 saía mais escura que a nota 6 — a melhor e a pior trocavam de peso visual.
// Validado --ordinal: L monotônica, todos os gaps ΔL ≥ 0.06, hue 8°,
// extremo escuro a 2.09:1 da superfície.
const SCORE_RAMP = [
  '#166534', // 6
  '#15803d', // 7
  '#16a34a', // 8
  '#22c55e', // 9
  '#4ade80', // 10
  '#86efac', // 11
  '#dcfce7', // 12
]

export const MIN_SCORE = 6

/** Cor da nota (6..12). Nota mais alta = verde mais claro. */
export function scoreRampColor(score: number): string {
  const step = Math.floor(score) - MIN_SCORE
  const index = Math.min(Math.max(step, 0), SCORE_RAMP.length - 1)
  return SCORE_RAMP[index]
}

/** Legenda da rampa, na ordem 6 → 12. */
export const SCORE_RAMP_LEGEND = SCORE_RAMP.map((color, i) => ({
  color,
  label: i === 0 ? `≤${MIN_SCORE}` : String(MIN_SCORE + i),
}))

// ── Escala da nota média — 5 níveis, vermelho → verde ───────────────────────
// Escala divergente: ruim e bom puxam para lados opostos, com o meio claro.
// A luminosidade faz 0.577 → 0.705 → 0.905 → 0.800 → 0.627 — sobe até o centro
// e desce para os dois extremos, que é a forma correta de uma divergente (por
// isso o teste --ordinal, que é sequencial, acusa "não monotônica": teste
// errado para esta escala).
//
// Corrige os dois defeitos da escala de 7 passos que existia antes:
//   · lá as notas 7 e 8 ficavam a ΔL 0.032 — indistinguíveis; aqui todo par
//     adjacente tem ΔL ≥ 0.06
//   · lá a nota 12 (L 0.527) saía MAIS ESCURA que a nota 6 (L 0.577), então a
//     melhor e a pior nota trocavam de peso visual; aqui os extremos ficam
//     equilibrados em 0.577 e 0.627
// Todos os 5 passam de 3:1 na superfície #27272a (o extremo vermelho a 3.08:1).
//
// ATENÇÃO: vermelho↔verde fica a ΔE 4.8 em protanopia — limite inerente ao par
// vermelho/verde, que nenhuma escolha de hex resolve. A mitigação é o número
// da nota renderizado ao lado da cor. Nunca usar esta escala sem esse rótulo.
export const SCORE_SCALE = [
  { max: 7,        color: '#dc2626', label: '<7' },
  { max: 8,        color: '#f97316', label: '7' },
  { max: 9,        color: '#fde047', label: '8' },
  { max: 11,       color: '#4ade80', label: '9 a 10' },
  { max: Infinity, color: '#16a34a', label: '11+' },
]

/** Cor da nota média. Exige o número visível ao lado (ver ATENÇÃO acima). */
export function scoreScaleColor(avgScore: number): string {
  return (SCORE_SCALE.find((t) => avgScore < t.max) ?? SCORE_SCALE[SCORE_SCALE.length - 1]).color
}

// ── Slots categóricos (identidade de farmer) ────────────────────────────────
// Ordem fixa, nunca ciclada. A paleta anterior tinha 24 hues ciclados por
// `index % 24` com 27 farmers ativos — três recebiam cor idêntica a outro —
// e colapsava em daltonismo (#3b82f6 ↔ #a855f7 a ΔE 0.9 em deuteranopia).
// Validado categórico em dark: pior par adjacente CVD ΔE 8.4, visão normal 19.3,
// todos os slots dentro da banda de luminosidade e ≥ 3:1 de contraste.
const SERIES_SLOTS = [
  '#3987e5', // 1 azul
  '#d95926', // 2 laranja
  '#199e70', // 3 aqua
  '#c98500', // 4 amarelo
  '#d55181', // 5 magenta
  '#008300', // 6 verde
  '#9085e9', // 7 violeta
  '#e66767', // 8 vermelho
]

/** Cinza reservado para o agrupamento "Outros". Nunca é um slot de série. */
export const OUTROS_COLOR = '#71717a'

/**
 * Cor do slot `index`, ciclando os 8 slots.
 *
 * TRADEOFF ASSUMIDO: com mais de 8 séries as cores se repetem — dois farmers
 * diferentes podem receber a mesma cor. Foi uma decisão de produto (mostrar
 * todos os farmers em vez de agrupar os menores em "Outros"). Cor deixa de ser
 * identidade confiável nesse cenário; quem identifica é o tooltip e a legenda.
 *
 * O que segura a leitura: a ordem da pilha é por volume e estável entre os
 * dias, então repetições caem a 8 posições de distância e raramente encostam.
 * Os 8 slots em si são validados — nenhum PAR de cores distintas colide.
 */
export function seriesColor(index: number): string {
  return SERIES_SLOTS[index % SERIES_SLOTS.length]
}

/** Sem corte: o gráfico por farmer mostra todos, sem agrupar em "Outros". */
export const SHOW_ALL_SERIES = Number.MAX_SAFE_INTEGER
