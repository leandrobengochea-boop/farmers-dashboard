import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/diario/session'
import AgendaClient from '@/components/diario/AgendaClient'

export const dynamic = 'force-dynamic'

export default function AgendaPage() {
  const usuario = usuarioAtual()
  if (!usuario) redirect('/diario/login')
  if (usuario.papel !== 'lider') redirect('/diario')

  return <AgendaClient usuario={usuario} />
}
