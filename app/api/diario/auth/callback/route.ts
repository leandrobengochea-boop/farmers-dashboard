import { NextResponse } from 'next/server'
import { COOKIE, criaToken } from '@/lib/diario/session'
import { origem, trocaCodePorEmail, usuarioPorEmail } from '@/lib/diario/google'

export const dynamic = 'force-dynamic'

function erro(req: Request, codigo: string) {
  return NextResponse.redirect(`${origem(req)}/diario/login?erro=${codigo}`)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const esperado = req.headers.get('cookie')?.match(/diario_state=([^;]+)/)?.[1]

  if (!code) return erro(req, 'login_cancelado')
  if (!state || !esperado || state !== esperado) return erro(req, 'state_invalido')

  const conta = await trocaCodePorEmail(req, code)
  if (!conta) return erro(req, 'conta_invalida')

  const usuario = await usuarioPorEmail(conta.email)
  if (!usuario) return erro(req, 'sem_carteira')

  const resp = NextResponse.redirect(`${origem(req)}${usuario.papel === 'lider' ? '/diario/agenda' : '/diario'}`)
  resp.cookies.set(COOKIE, criaToken(usuario.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  resp.cookies.set('diario_state', '', { path: '/', maxAge: 0 })
  return resp
}
