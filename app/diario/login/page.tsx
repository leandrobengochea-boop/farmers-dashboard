import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/diario/session'
import { googleConfigurado } from '@/lib/diario/google'
import LoginForm from '@/components/diario/LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage({ searchParams }: { searchParams: { erro?: string } }) {
  const usuario = usuarioAtual()
  if (usuario) redirect(usuario.papel === 'lider' ? '/diario/agenda' : '/diario')

  return <LoginForm google={googleConfigurado} erro={searchParams.erro} />
}
