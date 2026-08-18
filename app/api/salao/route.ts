import { NextResponse } from 'next/server'
import { fetchSalaoData } from '@/lib/salao'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function GET() {
  try {
    const data = await fetchSalaoData()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Salao fetch failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
