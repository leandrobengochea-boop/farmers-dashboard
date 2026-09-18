import { redirect } from 'next/navigation'
import { FARMERS } from '@/lib/constants'
import { usuarioAtual } from '@/lib/diario/session'
import { farmersDoLider } from '@/lib/diario/constants'
import DiarioClient from '@/components/diario/DiarioClient'

export const dynamic = 'force-dynamic'

export default function DiarioPage() {
  const usuario = usuarioAtual()
  if (!usuario) redirect('/diario/login')

  const farmers = usuario.papel === 'lider'
    ? farmersDoLider(usuario.timeKey).map((id) => ({ id, nome: FARMERS[id] ?? id }))
    : [{ id: usuario.id, nome: usuario.nome }]

  return <DiarioClient usuario={usuario} farmers={farmers} />
}
