'use client'

import { useRouter } from 'next/navigation'
import { LogoPSA, iniciais } from './Marca'

export interface Aba {
  chave: string
  rotulo: string
  href: string
  /** Papéis que enxergam a aba. Vazio = todos. */
  papeis?: string[]
}

/**
 * Abas do diário. Para adicionar uma nova, basta uma entrada aqui — ela
 * aparece no mesmo lugar em todas as telas.
 */
export const ABAS: Aba[] = [
  { chave: 'agenda', rotulo: 'Agenda do dia', href: '/diario/agenda', papeis: ['lider'] },
  { chave: 'diario', rotulo: 'Diário de bordo', href: '/diario' },
  { chave: 'ajuda', rotulo: 'Como funciona', href: '/diario/ajuda' },
]

interface Props {
  titulo: string
  subtitulo: string
  usuario: { nome: string; papel?: string }
  ativa: string
}

export default function Cabecalho({ titulo, subtitulo, usuario, ativa }: Props) {
  const router = useRouter()
  const abas = ABAS.filter((a) => !a.papeis || a.papeis.includes(usuario.papel ?? ''))

  async function sair() {
    await fetch('/api/diario/logout', { method: 'POST' })
    router.push('/diario/login')
    router.refresh()
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <LogoPSA />
        <div>
          <h1 className="font-black tracking-tight text-2xl uppercase leading-none">{titulo}</h1>
          <p className="text-sm text-zinc-500 mt-1">{subtitulo}</p>
        </div>
      </div>

      {/* Navegação e identidade moram sempre aqui, em qualquer tela. */}
      <div className="flex items-center gap-3 flex-wrap justify-end">
        <nav className="flex rounded-full bg-zinc-100 p-1">
          {abas.map((a) => (
            <a
              key={a.chave}
              href={a.href}
              className={`px-4 py-1.5 text-sm rounded-full transition whitespace-nowrap ${
                ativa === a.chave ? 'bg-white shadow-sm font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {a.rotulo}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full pl-1.5 pr-4 py-1.5">
          <span className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold grid place-items-center">
            {iniciais(usuario.nome)}
          </span>
          <span className="text-sm font-medium whitespace-nowrap">{usuario.nome}</span>
        </div>
        <button onClick={sair} className="text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-2">
          Sair
        </button>
      </div>
    </header>
  )
}
