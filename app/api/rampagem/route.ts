import { NextResponse } from 'next/server'
import { fetchRampagemData } from '@/lib/rampagem'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function GET() {
  try {
    const data = await fetchRampagemData()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Rampagem fetch failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
