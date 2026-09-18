import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { googleConfigurado, urlDeAutorizacao } from '@/lib/diario/google'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!googleConfigurado) {
    return NextResponse.redirect(new URL('/diario/login?erro=google_nao_configurado', req.url))
  }
  const state = randomBytes(16).toString('hex')
  const resp = NextResponse.redirect(urlDeAutorizacao(req, state))
  resp.cookies.set('diario_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return resp
}
