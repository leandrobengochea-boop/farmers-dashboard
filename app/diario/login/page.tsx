import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/diario/session'
import { LIDERES, farmersAtivos } from '@/lib/diario/constants'
import { googleConfigurado } from '@/lib/diario/google'
import LoginForm, { OpcaoUsuario } from '@/components/diario/LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage({ searchParams }: { searchParams: { erro?: string } }) {
  const usuario = usuarioAtual()
  if (usuario) redirect(usuario.papel === 'lider' ? '/diario/agenda' : '/diario')

  const opcoes: OpcaoUsuario[] = [
    ...LIDERES.map((l) => ({ id: l.id, nome: l.nome, grupo: 'Líderes' })),
    ...farmersAtivos().map((f) => ({ id: f.id, nome: f.nome, grupo: f.timeLabel })),
  ]

  return <LoginForm opcoes={opcoes} google={googleConfigurado} erro={searchParams.erro} />
}
