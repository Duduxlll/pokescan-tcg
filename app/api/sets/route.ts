import { NextResponse } from 'next/server'

const TCG_API = 'https://api.pokemontcg.io/v2'
const API_KEY = process.env.POKEMON_TCG_API_KEY || ''

export async function GET() {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (API_KEY) headers['X-Api-Key'] = API_KEY

    const res = await fetch(`${TCG_API}/sets?orderBy=-releaseDate&pageSize=250`, { headers })
    const data = await res.json()

    const sets = (data.data || []).map((set: any) => ({
      id: set.id,
      name: set.name,
      series: set.series,
      total: set.total,
      releaseDate: set.releaseDate,
      images: set.images,
    }))

    return NextResponse.json({ sets })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar sets' }, { status: 500 })
  }
}
