import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Diário de Bordo | PSA',
  description: 'Planejamento diário da carteira do farmer',
}

export default function DiarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#f6f6f7] text-zinc-900">
      {children}
    </div>
  )
}
