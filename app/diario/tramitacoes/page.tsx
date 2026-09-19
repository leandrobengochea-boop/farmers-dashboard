import { redirect } from 'next/navigation'
import { FARMERS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import TramitacoesClient from '@/components/diario/TramitacoesClient'

export const dynamic = 'force-dynamic'

export default function TramitacoesPage() {
  const usuario = usuarioAtual()
  if (!usuario) redirect('/diario/login')

  const farmers = usuario.papel === 'lider'
    ? farmersDoLider(usuario.timeKey).map((id) => ({ id, nome: FARMERS[id] ?? id }))
    : [{ id: usuario.id, nome: usuario.nome }]

  return <TramitacoesClient usuario={usuario} farmers={farmers} />
}
