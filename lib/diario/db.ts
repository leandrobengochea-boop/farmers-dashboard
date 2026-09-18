import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ── Modelo ──

/** rascunho → planejado (abordagens definidas) → fechado (resultados registrados) → revisado (líder deu o ok) */
export type StatusBriefing = 'rascunho' | 'planejado' | 'fechado' | 'revisado'

export interface ItemDiario {
  farmerId: string
  data: string            // YYYY-MM-DD
  companyId: string
  companyName: string
  bucket: string
  diasDesdeCompra: number | null
  ultimaCompra: string | null
  ultimoContato: string | null
  abordagem: string | null
  observacao: string | null            // contexto definido de manhã
  resultado: string | null             // 'efetivo' | 'tentativa' | 'nao_abordei'
  observacaoResultado: string | null   // o que saiu do contato, registrado no fechamento
}

export interface Briefing {
  farmerId: string
  data: string
  status: StatusBriefing
  enviadoEm: string | null
  decididoEm: string | null
  decididoPor: string | null
  comentarioLider: string | null
}

/** Orientação que o líder escreve para uma empresa específica do farmer. */
export interface Orientacao {
  farmerId: string
  companyId: string
  texto: string
  autor: string
  criadoEm: string
}

export type PatchItem = Partial<Pick<ItemDiario, 'abordagem' | 'observacao' | 'resultado' | 'observacaoResultado'>>

// ── Driver Postgres (Neon / Vercel Postgres) ──

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>
let sqlClient: SqlFn | null = null

function sql(): SqlFn {
  if (!sqlClient) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { neon } = require('@neondatabase/serverless') as { neon: (cs: string) => SqlFn }
    sqlClient = neon(connectionString)
  }
  return sqlClient
}

export const usandoPostgres = !!connectionString

let schemaPronto = false

async function garanteSchema(): Promise<void> {
  if (schemaPronto) return
  const q = sql()
  await q`
    CREATE TABLE IF NOT EXISTS diario_item (
      farmer_id         text    NOT NULL,
      data              date    NOT NULL,
      company_id        text    NOT NULL,
      company_name      text    NOT NULL,
      bucket            text    NOT NULL,
      dias_desde_compra integer,
      ultima_compra     date,
      ultimo_contato    date,
      abordagem         text,
      observacao        text,
      resultado         text,
      observacao_resultado text,
      criado_em         timestamptz NOT NULL DEFAULT now(),
      atualizado_em     timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (farmer_id, data, company_id)
    )`
  await q`CREATE INDEX IF NOT EXISTS diario_item_farmer_data ON diario_item (farmer_id, data)`
  // tabelas criadas pela primeira versão não tinham a observação de resultado
  await q`ALTER TABLE diario_item ADD COLUMN IF NOT EXISTS observacao_resultado text`
  await q`
    CREATE TABLE IF NOT EXISTS diario_briefing (
      farmer_id        text NOT NULL,
      data             date NOT NULL,
      status           text NOT NULL DEFAULT 'rascunho',
      enviado_em       timestamptz,
      decidido_em      timestamptz,
      decidido_por     text,
      comentario_lider text,
      PRIMARY KEY (farmer_id, data)
    )`
  await q`
    CREATE TABLE IF NOT EXISTS diario_orientacao (
      farmer_id  text NOT NULL,
      company_id text NOT NULL,
      texto      text NOT NULL,
      autor      text NOT NULL,
      criado_em  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (farmer_id, company_id)
    )`
  schemaPronto = true
}

// ── Driver local (arquivo JSON) — usado quando não há DATABASE_URL ──

interface DadosLocais { itens: ItemDiario[]; briefings: Briefing[]; orientacoes?: Orientacao[] }

const arquivoLocal = join(process.cwd(), '.diario-data', 'diario.json')

function leLocal(): DadosLocais {
  try {
    const d = JSON.parse(readFileSync(arquivoLocal, 'utf-8')) as DadosLocais
    return { itens: d.itens ?? [], briefings: d.briefings ?? [], orientacoes: d.orientacoes ?? [] }
  } catch {
    return { itens: [], briefings: [], orientacoes: [] }
  }
}

function gravaLocal(dados: DadosLocais): void {
  const dir = join(process.cwd(), '.diario-data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(arquivoLocal, JSON.stringify(dados, null, 2))
}

function iso(valor: unknown): string | null {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return null
}

function linhaParaItem(r: Record<string, unknown>): ItemDiario {
  return {
    farmerId: String(r.farmer_id),
    data: iso(r.data) ?? '',
    companyId: String(r.company_id),
    companyName: String(r.company_name ?? ''),
    bucket: String(r.bucket ?? ''),
    diasDesdeCompra: r.dias_desde_compra === null || r.dias_desde_compra === undefined ? null : Number(r.dias_desde_compra),
    ultimaCompra: iso(r.ultima_compra),
    ultimoContato: iso(r.ultimo_contato),
    abordagem: (r.abordagem as string) ?? null,
    observacao: (r.observacao as string) ?? null,
    resultado: (r.resultado as string) ?? null,
    observacaoResultado: (r.observacao_resultado as string) ?? null,
  }
}

function linhaParaBriefing(r: Record<string, unknown>): Briefing {
  return {
    farmerId: String(r.farmer_id),
    data: iso(r.data) ?? '',
    status: (r.status as StatusBriefing) ?? 'rascunho',
    enviadoEm: r.enviado_em ? new Date(r.enviado_em as string).toISOString() : null,
    decididoEm: r.decidido_em ? new Date(r.decidido_em as string).toISOString() : null,
    decididoPor: (r.decidido_por as string) ?? null,
    comentarioLider: (r.comentario_lider as string) ?? null,
  }
}

// ── API pública ──

export async function itensDoDia(farmerId: string, data: string): Promise<ItemDiario[]> {
  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`
      SELECT * FROM diario_item WHERE farmer_id = ${farmerId} AND data = ${data}
      ORDER BY bucket, company_name`
    return rows.map(linhaParaItem)
  }
  return leLocal().itens
    .filter((i) => i.farmerId === farmerId && i.data === data)
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.companyName.localeCompare(b.companyName))
}

/** Grava a lista sugerida do dia. Itens já existentes são preservados (não reembaralha). */
export async function gravaSugestoes(itens: ItemDiario[]): Promise<void> {
  if (itens.length === 0) return
  if (usandoPostgres) {
    await garanteSchema()
    const q = sql()
    for (const i of itens) {
      await q`
        INSERT INTO diario_item (farmer_id, data, company_id, company_name, bucket, dias_desde_compra, ultima_compra, ultimo_contato, abordagem)
        VALUES (${i.farmerId}, ${i.data}, ${i.companyId}, ${i.companyName}, ${i.bucket}, ${i.diasDesdeCompra}, ${i.ultimaCompra}, ${i.ultimoContato}, ${i.abordagem})
        ON CONFLICT (farmer_id, data, company_id) DO NOTHING`
    }
    return
  }
  const dados = leLocal()
  for (const i of itens) {
    const existe = dados.itens.some((x) => x.farmerId === i.farmerId && x.data === i.data && x.companyId === i.companyId)
    if (!existe) dados.itens.push(i)
  }
  gravaLocal(dados)
}

export async function atualizaItem(farmerId: string, data: string, companyId: string, patch: PatchItem): Promise<void> {
  // Só sobrescreve o que veio no patch — `undefined` nunca apaga valor salvo.
  const campos: PatchItem = {}
  if (patch.abordagem !== undefined) campos.abordagem = patch.abordagem
  if (patch.observacao !== undefined) campos.observacao = patch.observacao
  if (patch.resultado !== undefined) campos.resultado = patch.resultado
  if (patch.observacaoResultado !== undefined) campos.observacaoResultado = patch.observacaoResultado
  if (Object.keys(campos).length === 0) return

  if (usandoPostgres) {
    await garanteSchema()
    const q = sql()
    const rows = await q`
      SELECT abordagem, observacao, resultado, observacao_resultado FROM diario_item
      WHERE farmer_id = ${farmerId} AND data = ${data} AND company_id = ${companyId}`
    if (rows.length === 0) return
    const atual = rows[0]
    const abordagem = campos.abordagem ?? ((atual.abordagem as string) ?? null)
    const observacao = campos.observacao ?? ((atual.observacao as string) ?? null)
    const resultado = campos.resultado ?? ((atual.resultado as string) ?? null)
    const observacaoResultado = campos.observacaoResultado ?? ((atual.observacao_resultado as string) ?? null)
    await q`
      UPDATE diario_item
      SET abordagem = ${abordagem}, observacao = ${observacao}, resultado = ${resultado},
          observacao_resultado = ${observacaoResultado}, atualizado_em = now()
      WHERE farmer_id = ${farmerId} AND data = ${data} AND company_id = ${companyId}`
    return
  }

  const dados = leLocal()
  const item = dados.itens.find((x) => x.farmerId === farmerId && x.data === data && x.companyId === companyId)
  if (item) Object.assign(item, campos)
  gravaLocal(dados)
}

export interface HistoricoEmpresa {
  companyId: string
  companyName: string
  ultimaData: string            // última vez que apareceu na lista (YYYY-MM-DD)
  ultimoResultado: string | null
  tentativasSeguidas: number    // "tentei, sem sucesso" consecutivos, do mais recente para trás
  aparicoes: number
}

type LinhaHistorico = { farmerId: string; companyId: string; companyName: string; data: string; resultado: string | null }

function montaHistorico(linhas: LinhaHistorico[]): Map<string, Map<string, HistoricoEmpresa>> {
  // linhas chegam ordenadas por farmer, empresa e data decrescente
  const porFarmer = new Map<string, Map<string, HistoricoEmpresa>>()
  for (const l of linhas) {
    let mapa = porFarmer.get(l.farmerId)
    if (!mapa) { mapa = new Map(); porFarmer.set(l.farmerId, mapa) }
    const atual = mapa.get(l.companyId)
    if (!atual) {
      mapa.set(l.companyId, {
        companyId: l.companyId,
        companyName: l.companyName,
        ultimaData: l.data,
        ultimoResultado: l.resultado,
        tentativasSeguidas: l.resultado === 'tentativa' ? 1 : 0,
        aparicoes: 1,
      })
      continue
    }
    atual.aparicoes++
    // só conta a sequência enquanto ela não for interrompida por outro resultado
    if (l.resultado === 'tentativa' && atual.tentativasSeguidas === atual.aparicoes - 1) {
      atual.tentativasSeguidas++
    }
  }
  return porFarmer
}

/** Histórico de cada empresa já sugerida a estes farmers, antes de `hoje`. */
export async function historicoDeVarios(farmerIds: string[], hoje: string): Promise<Map<string, Map<string, HistoricoEmpresa>>> {
  if (farmerIds.length === 0) return new Map()
  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`
      SELECT farmer_id, company_id, company_name, data, resultado FROM diario_item
      WHERE farmer_id = ANY(${farmerIds}) AND data < ${hoje}::date
      ORDER BY farmer_id, company_id, data DESC`
    return montaHistorico(rows.map((r) => ({
      farmerId: String(r.farmer_id),
      companyId: String(r.company_id),
      companyName: String(r.company_name ?? ''),
      data: iso(r.data) ?? '',
      resultado: (r.resultado as string) ?? null,
    })))
  }
  const linhas = leLocal().itens
    .filter((i) => farmerIds.includes(i.farmerId) && i.data < hoje)
    .sort((a, b) => a.farmerId.localeCompare(b.farmerId) || a.companyId.localeCompare(b.companyId) || b.data.localeCompare(a.data))
    .map((i) => ({ farmerId: i.farmerId, companyId: i.companyId, companyName: i.companyName, data: i.data, resultado: i.resultado }))
  return montaHistorico(linhas)
}

/** Histórico de cada empresa já sugerida a este farmer, antes de `hoje`. */
export async function historicoDoFarmer(farmerId: string, hoje: string): Promise<Map<string, HistoricoEmpresa>> {
  const porFarmer = await historicoDeVarios([farmerId], hoje)
  return porFarmer.get(farmerId) ?? new Map()
}

export async function briefing(farmerId: string, data: string): Promise<Briefing> {
  const vazio: Briefing = { farmerId, data, status: 'rascunho', enviadoEm: null, decididoEm: null, decididoPor: null, comentarioLider: null }
  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`SELECT * FROM diario_briefing WHERE farmer_id = ${farmerId} AND data = ${data}`
    return rows.length ? linhaParaBriefing(rows[0]) : vazio
  }
  return leLocal().briefings.find((b) => b.farmerId === farmerId && b.data === data) ?? vazio
}

export async function briefingsDoDia(farmerIds: string[], data: string): Promise<Briefing[]> {
  if (farmerIds.length === 0) return []
  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`SELECT * FROM diario_briefing WHERE data = ${data} AND farmer_id = ANY(${farmerIds})`
    return rows.map(linhaParaBriefing)
  }
  return leLocal().briefings.filter((b) => b.data === data && farmerIds.includes(b.farmerId))
}

/** Todas as empresas do dia dos farmers informados — a lista inteira é o compromisso. */
export async function itensDoDiaDeVarios(farmerIds: string[], data: string): Promise<ItemDiario[]> {
  if (farmerIds.length === 0) return []
  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`
      SELECT * FROM diario_item
      WHERE data = ${data} AND farmer_id = ANY(${farmerIds})
      ORDER BY farmer_id, company_name`
    return rows.map(linhaParaItem)
  }
  return leLocal().itens
    .filter((i) => i.data === data && farmerIds.includes(i.farmerId))
    .sort((a, b) => a.farmerId.localeCompare(b.farmerId) || a.companyName.localeCompare(b.companyName))
}

export async function salvaBriefing(b: Briefing): Promise<void> {
  if (usandoPostgres) {
    await garanteSchema()
    await sql()`
      INSERT INTO diario_briefing (farmer_id, data, status, enviado_em, decidido_em, decidido_por, comentario_lider)
      VALUES (${b.farmerId}, ${b.data}, ${b.status}, ${b.enviadoEm}, ${b.decididoEm}, ${b.decididoPor}, ${b.comentarioLider})
      ON CONFLICT (farmer_id, data) DO UPDATE SET
        status = EXCLUDED.status,
        enviado_em = EXCLUDED.enviado_em,
        decidido_em = EXCLUDED.decidido_em,
        decidido_por = EXCLUDED.decidido_por,
        comentario_lider = EXCLUDED.comentario_lider`
    return
  }
  const dados = leLocal()
  const i = dados.briefings.findIndex((x) => x.farmerId === b.farmerId && x.data === b.data)
  if (i >= 0) dados.briefings[i] = b
  else dados.briefings.push(b)
  gravaLocal(dados)
}

/** Orientações vigentes destes farmers, indexadas por farmer e empresa. */
export async function orientacoesDe(farmerIds: string[]): Promise<Map<string, Map<string, Orientacao>>> {
  const fora = new Map<string, Map<string, Orientacao>>()
  if (farmerIds.length === 0) return fora

  const guarda = (o: Orientacao) => {
    let m = fora.get(o.farmerId)
    if (!m) { m = new Map(); fora.set(o.farmerId, m) }
    m.set(o.companyId, o)
  }

  if (usandoPostgres) {
    await garanteSchema()
    const rows = await sql()`SELECT * FROM diario_orientacao WHERE farmer_id = ANY(${farmerIds})`
    for (const r of rows) {
      guarda({
        farmerId: String(r.farmer_id),
        companyId: String(r.company_id),
        texto: String(r.texto ?? ''),
        autor: String(r.autor ?? ''),
        criadoEm: r.criado_em ? new Date(r.criado_em as string).toISOString() : '',
      })
    }
    return fora
  }
  for (const o of leLocal().orientacoes ?? []) {
    if (farmerIds.includes(o.farmerId)) guarda(o)
  }
  return fora
}

export async function salvaOrientacao(o: Orientacao): Promise<void> {
  if (usandoPostgres) {
    await garanteSchema()
    await sql()`
      INSERT INTO diario_orientacao (farmer_id, company_id, texto, autor)
      VALUES (${o.farmerId}, ${o.companyId}, ${o.texto}, ${o.autor})
      ON CONFLICT (farmer_id, company_id) DO UPDATE SET
        texto = EXCLUDED.texto, autor = EXCLUDED.autor, criado_em = now()`
    return
  }
  const dados = leLocal()
  const lista = dados.orientacoes ?? []
  const i = lista.findIndex((x) => x.farmerId === o.farmerId && x.companyId === o.companyId)
  if (i >= 0) lista[i] = o
  else lista.push(o)
  dados.orientacoes = lista
  gravaLocal(dados)
}
