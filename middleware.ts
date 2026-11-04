import { NextResponse } from 'next/server'

// Diário de Bordo fora do ar. O código continua no repositório.
// Para religar, apague este arquivo.
export function middleware() {
  return new NextResponse('Diário de Bordo fora do ar.', {
    status: 410,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export const config = {
  matcher: ['/diario/:path*', '/diario', '/api/diario/:path*'],
}
