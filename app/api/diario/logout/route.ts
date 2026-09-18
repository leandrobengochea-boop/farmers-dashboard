import { NextResponse } from 'next/server'
import { COOKIE } from '@/lib/diario/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const resp = NextResponse.json({ ok: true })
  resp.cookies.set(COOKIE, '', { path: '/', maxAge: 0 })
  return resp
}
