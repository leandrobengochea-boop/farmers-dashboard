import { NextResponse } from 'next/server'
import { fetchAllDeals } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function GET() {
  try {
    const result = await fetchAllDeals()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to fetch deals:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
