import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Farmers Dashboard',
  description: 'Dashboard de qualificação para o time de Farmers',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-black text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
