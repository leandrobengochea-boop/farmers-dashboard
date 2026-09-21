import { EMAIL_DO_DIARIO, Usuario, usuarioPorId } from './constants'

export const DOMINIO_PERMITIDO = 'profissionaissa.com'
export const googleConfigurado = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

/** Origem pública da requisição — funciona atrás do proxy da Vercel e em localhost. */
export function origem(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

export function redirectUri(req: Request): string {
  return `${origem(req)}/api/diario/auth/callback`
}

export function urlDeAutorizacao(req: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    hd: DOMINIO_PERMITIDO,       // dica: só mostra contas do domínio
    prompt: 'select_account',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

interface PayloadIdToken { email?: string; email_verified?: boolean | string; hd?: string; name?: string }

/**
 * Troca o code pelo id_token. O token chega direto do Google por TLS na resposta
 * da troca, então o payload é confiável sem validar a assinatura por fora.
 */
export async function trocaCodePorEmail(req: Request, code: string): Promise<{ email: string; nome: string } | null> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })
  if (!resp.ok) {
    console.error('troca de code com o Google falhou:', resp.status, await resp.text())
    return null
  }
  const { id_token } = (await resp.json()) as { id_token?: string }
  if (!id_token) return null

  const parte = id_token.split('.')[1]
  if (!parte) return null
  const payload = JSON.parse(Buffer.from(parte, 'base64url').toString('utf-8')) as PayloadIdToken
  const email = (payload.email ?? '').toLowerCase()
  const verificado = payload.email_verified === true || payload.email_verified === 'true'
  if (!email || !verificado) return null
  if (email.split('@')[1] !== DOMINIO_PERMITIDO) return null
  return { email, nome: payload.name ?? email }
}

// ── e-mail do Google → dono da carteira no HubSpot ──

let cache: { em: number; mapa: Record<string, string> } | null = null
const VALIDADE_CACHE = 10 * 60 * 1000

async function mapaEmailParaOwner(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.em < VALIDADE_CACHE) return cache.mapa
  const pat = process.env.HUBSPOT_PAT
  if (!pat) throw new Error('HUBSPOT_PAT não configurado')

  const mapa: Record<string, string> = {}
  let after: string | undefined
  while (true) {
    const url = new URL('https://api.hubapi.com/crm/v3/owners')
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${pat}` }, cache: 'no-store' })
    if (!resp.ok) break
    const data = (await resp.json()) as {
      results?: Array<{ id: string; email?: string }>
      paging?: { next?: { after?: string } }
    }
    for (const o of data.results ?? []) {
      if (o.email) mapa[o.email.toLowerCase()] = o.id
    }
    const proximo = data.paging?.next?.after
    if (!proximo) break
    after = proximo
  }
  cache = { em: Date.now(), mapa }
  return mapa
}

/** Resolve o e-mail corporativo no usuário do diário (farmer ou líder). */
export async function usuarioPorEmail(email: string): Promise<Usuario | null> {
  const chave = email.toLowerCase()
  const mapa = await mapaEmailParaOwner()
  const ownerId = EMAIL_DO_DIARIO[chave] ?? mapa[chave]
  if (!ownerId) return null
  return usuarioPorId(ownerId)
}
