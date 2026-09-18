'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoPSA } from './Marca'

export interface OpcaoUsuario {
  id: string
  nome: string
  grupo: string
}

export default function LoginForm({ opcoes }: { opcoes: OpcaoUsuario[] }) {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
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
    router.push('/diario')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-1">
          <LogoPSA />
          <div className="w-px h-6 bg-zinc-300" />
          <h1 className="font-black tracking-tight text-lg uppercase">Diário de bordo</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-6">Planejamento diário da carteira</p>

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

        {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition"
          style={{ background: '#FF5200' }}
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
