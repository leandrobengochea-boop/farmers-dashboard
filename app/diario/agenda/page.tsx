import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/diario/session'
import AgendaClient from '@/components/diario/AgendaClient'

export const dynamic = 'force-dynamic'

export default function AgendaPage() {
  const usuario = usuarioAtual()
  if (!usuario) redirect('/diario/login')

  // O farmer também acompanha a própria evolução do dia, com o mesmo cartão.
  return <AgendaClient usuario={usuario} />
}
