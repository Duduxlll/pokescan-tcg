import { NextResponse } from 'next/server'
import { getCurrentCard, setCurrentCard, clearCurrentCard, CardData } from '@/lib/card-store'

export async function GET() {
  const card = await getCurrentCard()
  return NextResponse.json({ card })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (body.clear) {
    await clearCurrentCard()
    return NextResponse.json({ ok: true })
  }
  await setCurrentCard(body as CardData)
  return NextResponse.json({ ok: true })
}
