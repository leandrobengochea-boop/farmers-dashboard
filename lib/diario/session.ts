import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { Usuario, usuarioPorId } from './constants'

export const COOKIE = 'diario_sessao'
const SEGREDO = process.env.DIARIO_SECRET || 'psa-diario-dev-secret'

/** PIN único do time. Trocar pelo env DIARIO_PIN em produção. */
export const PIN = process.env.DIARIO_PIN || '2026'

function assina(valor: string): string {
  return createHmac('sha256', SEGREDO).update(valor).digest('hex').slice(0, 32)
}

export function criaToken(userId: string): string {
  return `${userId}.${assina(userId)}`
}

export function verificaToken(token: string | undefined): string | null {
  if (!token) return null
  const [userId, assinatura] = token.split('.')
  if (!userId || !assinatura) return null
  const esperado = assina(userId)
  if (assinatura.length !== esperado.length) return null
  if (!timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return null
  return userId
}

export function pinValido(pin: string): boolean {
  const a = Buffer.from(pin ?? '')
  const b = Buffer.from(PIN)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Usuário logado, ou null. */
export function usuarioAtual(): Usuario | null {
  const token = cookies().get(COOKIE)?.value
  const id = verificaToken(token)
  return id ? usuarioPorId(id) : null
}
