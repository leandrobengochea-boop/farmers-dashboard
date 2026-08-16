import { NextResponse } from 'next/server'
import { fetchRecordesData } from '@/lib/recordes'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 120

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === '1'
    const data = await fetchRecordesData(force)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Recordes fetch failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
