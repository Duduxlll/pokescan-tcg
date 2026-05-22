import { NextResponse } from 'next/server'

const TCG_API = 'https://api.pokemontcg.io/v2'
const API_KEY = process.env.POKEMON_TCG_API_KEY || ''

function buildHeaders() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) h['X-Api-Key'] = API_KEY
  return h
}

async function fetchCards(query: string) {
  const url = `${TCG_API}/cards?q=${encodeURIComponent(query)}&pageSize=12&orderBy=name`
  const res = await fetch(url, { headers: buildHeaders() })
  const data = await res.json()
  return data.data || []
}

function mapCard(card: any) {
  const tcp = card.tcgplayer?.prices || {}
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    set: { id: card.set?.id, name: card.set?.name, series: card.set?.series },
    images: { small: card.images?.small, large: card.images?.large },
    rarity: card.rarity,
    types: card.types,
    hp: card.hp,
    prices: {
      usdNormal:  tcp.normal?.market || null,
      usdFoil:    tcp.holofoil?.market || tcp.reverseHolofoil?.market
                  || tcp['1stEditionHolofoil']?.market || null,
      // fallback combinado para compatibilidade
      usd: tcp.normal?.market || tcp.holofoil?.market
           || tcp.reverseHolofoil?.market || tcp['1stEditionHolofoil']?.market || null,
      cardmarket: card.cardmarket?.prices?.averageSellPrice || null,
      cardmarketLow: card.cardmarket?.prices?.lowPrice || null,
    },
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawName   = (searchParams.get('name')   || '').trim()
  const rawNumber = (searchParams.get('number') || '').trim()
  const setId     = (searchParams.get('setId')  || '').trim()

  if (!rawName && !rawNumber) {
    return NextResponse.json({ error: 'Nome ou número obrigatório' }, { status: 400 })
  }

  try {
    // Número: pega só a parte antes da barra ("SV110/SV122" → "SV110", "025/073" → "025")
    const cleanNumber = rawNumber.split('/')[0].trim().replace(/^0+(\d)/, '$1')

    // Nome completo preservando sufixos V/VMAX/ex (importante para busca exata)
    const fullName = rawName.trim()

    // Nome base sem sufixo TCG (fallback quando o OCR capturou errado)
    const baseName = rawName.replace(/\s+(VMAX|VSTAR|GX|EX|V)\s*$/i, '').trim()
    const hasSuffix = fullName !== baseName

    let raw: any[] = []

    // ── T1: nome exato completo + número + set ────────────────────────────
    if (raw.length === 0 && fullName && cleanNumber && setId)
      raw = await fetchCards(`name:"${fullName}" number:${cleanNumber} set.id:${setId}`)

    // ── T2: nome exato completo + set ─────────────────────────────────────
    if (raw.length === 0 && fullName && setId)
      raw = await fetchCards(`name:"${fullName}" set.id:${setId}`)

    // ── T3: nome completo wildcard + set ──────────────────────────────────
    if (raw.length === 0 && fullName && setId)
      raw = await fetchCards(`name:${fullName}* set.id:${setId}`)

    // ── T4: número + set (só número, ignora nome) ─────────────────────────
    if (raw.length === 0 && cleanNumber && setId)
      raw = await fetchCards(`number:${cleanNumber} set.id:${setId}`)

    // ── T5: nome base + número + set (OCR pode ter errado o sufixo) ───────
    if (raw.length === 0 && hasSuffix && baseName && cleanNumber && setId)
      raw = await fetchCards(`name:"${baseName}" number:${cleanNumber} set.id:${setId}`)

    // ── T6: nome base wildcard + set ──────────────────────────────────────
    if (raw.length === 0 && baseName && setId)
      raw = await fetchCards(`name:${baseName}* set.id:${setId}`)

    // ── T7: nome exato completo sem filtro de set ─────────────────────────
    if (raw.length === 0 && fullName)
      raw = await fetchCards(`name:"${fullName}"`)

    // ── T8: nome base wildcard sem set (última tentativa) ─────────────────
    if (raw.length === 0 && baseName)
      raw = await fetchCards(`name:${baseName}*`)

    // Ordena: prioriza cartas do set selecionado
    if (setId && raw.length > 1) {
      raw.sort((a: any, b: any) => {
        const aMatch = a.set?.id === setId ? -1 : 0
        const bMatch = b.set?.id === setId ? -1 : 0
        return aMatch - bMatch
      })
    }

    const cards = raw.map(mapCard)
    return NextResponse.json({ cards, total: cards.length })

  } catch (err) {
    console.error('Cards error:', err)
    return NextResponse.json({ error: 'Erro ao buscar cartas' }, { status: 500 })
  }
}
