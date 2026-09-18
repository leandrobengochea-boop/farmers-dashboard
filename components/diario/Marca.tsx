export function LogoPSA({ className = '' }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontWeight: 900,
        fontSize: '1.5rem',
        letterSpacing: '-0.02em',
        color: '#FF5200',
        fontFamily: "'Arial Black', 'Arial Bold', Arial, sans-serif",
        lineHeight: 1,
      }}
    >
      PSA.
    </span>
  )
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

export function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function dataLonga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })
}

export function meses(dias: number | null): string {
  if (dias === null) return 'sem histórico'
  const m = Math.floor(dias / 30.44)
  if (m < 1) return `${dias} dias`
  if (m < 24) return `${m} meses`
  return `${Math.floor(m / 12)} anos`
}
