import { NextResponse } from 'next/server'
import { COOKIE, criaToken, pinValido } from '@/lib/diario/session'
import { usuarioPorId } from '@/lib/diario/constants'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { userId, pin } = (await req.json()) as { userId?: string; pin?: string }
  if (!userId || !usuarioPorId(userId)) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 400 })
  }
  if (!pinValido(pin ?? '')) {
    return NextResponse.json({ error: 'PIN incorreto' }, { status: 401 })
  }
  const resp = NextResponse.json({ ok: true, usuario: usuarioPorId(userId) })
  resp.cookies.set(COOKIE, criaToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return resp
}
