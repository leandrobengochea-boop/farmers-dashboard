/**
 * Dias úteis do diário.
 *
 * Existe porque o diário monta lista em qualquer dia em que alguém abre a tela,
 * e sábado, domingo e feriado entravam no relatório com 20 empresas e zero
 * resultado — puxando a efetividade do time para baixo sem ninguém ter
 * trabalhado. No período de set/out eram 5 dias assim, que custavam 3 pontos.
 */

/** Domingo de Páscoa pelo algoritmo de Gauss/Computus. */
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

function maisDias(d: Date, dias: number): Date {
  const nova = new Date(d)
  nova.setUTCDate(nova.getUTCDate() + dias)
  return nova
}

const cache = new Map<number, Set<string>>()

/**
 * Feriados nacionais do ano, com os móveis calculados a partir da Páscoa — não
 * é uma tabela para atualizar todo ano. Carnaval e quarta-feira de cinzas não
 * são feriado por lei, mas ninguém da operação trabalha, então entram.
 */
export function feriadosNacionais(ano: number): Set<string> {
  const guardado = cache.get(ano)
  if (guardado) return guardado

  const p = pascoa(ano)
  const dias = new Set<string>([
    `${ano}-01-01`, // Confraternização Universal
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    `${ano}-11-20`, // Consciência Negra
    `${ano}-12-25`, // Natal
    iso(maisDias(p, -48)), // segunda de carnaval
    iso(maisDias(p, -47)), // terça de carnaval
    iso(maisDias(p, -2)),  // sexta-feira santa
    iso(maisDias(p, 60)),  // Corpus Christi
  ])
  cache.set(ano, dias)
  return dias
}

/** Sábado, domingo e feriado nacional não são dia de diário. */
export function ehDiaUtil(data: string): boolean {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay()
  if (d === 0 || d === 6) return false
  return !feriadosNacionais(Number(data.slice(0, 4))).has(data)
}

/**
 * Primeiro dia de uma janela de N dias úteis que termina em `ate`.
 *
 * A janela do relatório conta dias de trabalho, não dias de calendário: numa
 * semana com feriado, "7 dias" corridos entregava 4 barras.
 */
export function inicioDaJanela(ate: string, diasUteis: number): string {
  let contados = 0
  const d = new Date(`${ate}T12:00:00Z`)
  // teto de segurança: nenhuma janela razoável precisa de mais de um ano
  for (let passos = 0; passos < 400; passos++) {
    const atual = d.toISOString().slice(0, 10)
    if (ehDiaUtil(atual)) contados++
    if (contados >= diasUteis) return atual
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}
