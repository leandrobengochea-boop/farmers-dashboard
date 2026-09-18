'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoPSA } from './Marca'

export interface OpcaoUsuario {
  id: string
  nome: string
  grupo: string
}

const MENSAGENS: Record<string, string> = {
  google_nao_configurado: 'Login com Google ainda não está configurado neste ambiente.',
  login_cancelado: 'Login cancelado.',
  state_invalido: 'A sessão de login expirou. Tente de novo.',
  conta_invalida: 'Use sua conta @profissionaissa.com.',
  sem_carteira: 'Sua conta não está vinculada a uma carteira no HubSpot. Fale com o RevOps.',
}

export default function LoginForm({
  opcoes,
  google,
  erro: erroInicial,
}: {
  opcoes: OpcaoUsuario[]
  google: boolean
  erro?: string
}) {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(erroInicial ? MENSAGENS[erroInicial] ?? 'Não consegui entrar.' : '')
  const [enviando, setEnviando] = useState(false)

  const grupos = Array.from(new Set(opcoes.map((o) => o.grupo)))

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const resp = await fetch('/api/diario/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin }),
    })
    setEnviando(false)
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({ error: 'falha no login' }))
      setErro(dados.error ?? 'falha no login')
      return
    }
    const { usuario } = await resp.json()
    router.push(usuario?.papel === 'lider' ? '/diario/agenda' : '/diario')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-1">
          <LogoPSA />
          <div className="w-px h-6 bg-zinc-300" />
          <h1 className="font-black tracking-tight text-lg uppercase">Diário de bordo</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-6">Planejamento diário da carteira</p>

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        {google && (
          <a
            href="/api/diario/auth/google"
            className="flex items-center justify-center gap-3 w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-semibold hover:bg-zinc-50 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.8 6.6-9.5 6.6-16.2z" />
              <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.9l-7.1-5.5c-2 1.3-4.6 2.2-8.8 2.2-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Entrar com a conta Google
          </a>
        )}

        {google && (
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] uppercase tracking-wide text-zinc-400">ou PIN do time</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>
        )}

        <form onSubmit={entrar}>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">Quem é você</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Selecione seu nome...</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                {opcoes.filter((o) => o.grupo === g).map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">PIN do time</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            inputMode="numeric"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />

          <button
            type="submit"
            disabled={enviando}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60 transition ${
              google ? 'border border-zinc-300 bg-white hover:bg-zinc-50' : 'text-white'
            }`}
            style={google ? undefined : { background: '#FF5200' }}
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
