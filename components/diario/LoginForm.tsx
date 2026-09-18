'use client'

import { LogoPSA } from './Marca'

const MENSAGENS: Record<string, string> = {
  google_nao_configurado: 'Login com Google ainda não está configurado neste ambiente.',
  login_cancelado: 'Login cancelado.',
  state_invalido: 'A sessão de login expirou. Tente de novo.',
  conta_invalida: 'Use sua conta @profissionaissa.com.',
  sem_carteira: 'Sua conta não está vinculada a uma carteira no HubSpot. Fale com o RevOps.',
}

export default function LoginForm({ google, erro }: { google: boolean; erro?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-1">
          <LogoPSA />
          <div className="w-px h-6 bg-zinc-300" />
          <h1 className="font-black tracking-tight text-lg uppercase">Diário de bordo</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-6">Planejamento diário da carteira</p>

        {erro && (
          <p className="text-sm text-red-600 mb-4">{MENSAGENS[erro] ?? 'Não consegui entrar.'}</p>
        )}

        {google ? (
          <>
            <a
              href="/api/diario/auth/google"
              className="flex items-center justify-center gap-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: '#FF5200' }}
            >
              <span className="w-5 h-5 rounded bg-white grid place-items-center">
                <svg className="w-3.5 h-3.5" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.8 6.6-9.5 6.6-16.2z" />
                  <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.9l-7.1-5.5c-2 1.3-4.6 2.2-8.8 2.2-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
                </svg>
              </span>
              Entrar com a conta Google
            </a>
            <p className="text-xs text-zinc-400 mt-4 text-center">
              Use seu e-mail @profissionaissa.com. A carteira vem do seu usuário no HubSpot.
            </p>
          </>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Login com Google não está configurado neste ambiente. Faltam as variáveis
            <code className="mx-1 text-xs">GOOGLE_CLIENT_ID</code> e
            <code className="mx-1 text-xs">GOOGLE_CLIENT_SECRET</code>.
          </div>
        )}
      </div>
    </div>
  )
}
