import { NextResponse } from 'next/server'

interface PriceBlock { min: number; avg: number; max: number }
interface LigaResult  { normal: PriceBlock | null; foil: PriceBlock | null }

const cache = new Map<string, { data: LigaResult; ts: number }>()
const TTL   = 30 * 60 * 1000

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer':         'https://www.ligapokemon.com.br/',
}

function cleanNumber(n: string): string {
  return /^\d+$/.test(n) ? String(parseInt(n, 10)) : n.toUpperCase()
}
function isJPorCN(num: string): boolean {
  return /(?:JP|CN|CHN|JAP)$/i.test(num)
}

async function get(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) })
    return res.ok ? await res.text() : ''
  } catch { return '' }
}

// Extrai preços do JSON embutido na página individual do card.
// O JS da Liga armazena: "price":{"0":{p,m,g},"2":{p,m,g},...}
// Chave "0" = Normal; chave "2" = Foil (extras id=2)
function extractPricesFromJS(html: string): LigaResult {
  const result: LigaResult = { normal: null, foil: null }

  const normalM = html.match(/"0":\{"p":"([\d.]+)","m":"([\d.]+)","g":"([\d.]+)"\}/)
  if (normalM) {
    const avg = parseFloat(normalM[2])
    if (avg > 0) result.normal = { min: parseFloat(normalM[1]), avg, max: parseFloat(normalM[3]) }
  }

  const foilM = html.match(/"2":\{"p":"([\d.]+)","m":"([\d.]+)","g":"([\d.]+)"\}/)
  if (foilM) {
    const avg = parseFloat(foilM[2])
    if (avg > 0) result.foil = { min: parseFloat(foilM[1]), avg, max: parseFloat(foilM[3]) }
  }

  return result
}

async function scrapeLiga(cardName: string, cardNumber: string): Promise<LigaResult> {
  // ── Passo 1: página de busca para encontrar o href individual do card ──────
  const searchUrl  = `https://www.ligapokemon.com.br/?view=cards/card&card=${encodeURIComponent(cardName)}&num=${encodeURIComponent(cardNumber)}&ed=`
  const searchHtml = await get(searchUrl)
  if (!searchHtml) return { normal: null, foil: null }

  const targetNum = cleanNumber(cardNumber)
  const blocks    = searchHtml.split('<div class="box p25">')
  let   cardHref  = ''

  for (const block of blocks.slice(1)) {
    if (!block.includes('view=cards/card')) continue
    if (block.includes('view=prod/view'))   continue

    const numM = block.match(/[?&]num=([A-Z0-9]+)/i)
    if (!numM) continue
    const ligaNum   = numM[1].toUpperCase()
    if (isJPorCN(ligaNum)) continue
    const ligaClean = cleanNumber(ligaNum)
    if (ligaClean !== targetNum && !ligaNum.startsWith(targetNum)) continue

    // Extrai o href (pode ter &amp; no HTML cru)
    const hrefM = block.match(/href="\.\/\?([^"]+)"/)
    if (hrefM) { cardHref = hrefM[1].replace(/&amp;/g, '&'); break }
  }

  if (!cardHref) return { normal: null, foil: null }

  // ── Passo 2: página individual — tem o JSON com preços Normal e Foil ───────
  const cardHtml = await get(`https://www.ligapokemon.com.br/?${cardHref}`)
  if (!cardHtml) return { normal: null, foil: null }

  return extractPricesFromJS(cardHtml)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name   = (searchParams.get('name')   || '').trim()
  const number = (searchParams.get('number') || '').trim()
  const debug  = searchParams.get('debug') === '1'

  if (!name || !number) {
    return NextResponse.json({ error: 'name e number obrigatórios' }, { status: 400 })
  }

  if (debug) {
    const searchUrl  = `https://www.ligapokemon.com.br/?view=cards/card&card=${encodeURIComponent(name)}&num=${encodeURIComponent(number)}&ed=`
    const searchHtml = await get(searchUrl)
    if (!searchHtml) return NextResponse.json({ error: 'sem HTML da Liga' })

    const targetNum = cleanNumber(number)
    const blocks    = searchHtml.split('<div class="box p25">').slice(1, 15)
    const blockInfo = blocks.map((b, i) => {
      const numM  = b.match(/[?&]num=([A-Z0-9]+)/i)
      const hrefM = b.match(/href="\.\/\?([^"]+)"/)
      const minM  = b.match(/class="price-min">(.*?)<\/div>/)
      const avgM  = b.match(/class="price-avg">(.*?)<\/div>/)
      return {
        index: i,
        num:   numM?.[1] ?? null,
        isCard: b.includes('view=cards/card'),
        isProd: b.includes('view=prod/view'),
        href:  hrefM ? hrefM[1].replace(/&amp;/g, '&').substring(0, 100) : null,
        min:   minM?.[1] ?? null,
        avg:   avgM?.[1] ?? null,
      }
    })

    // Tenta ir passo 2 com primeiro bloco card que bate o número
    let cardHref = ''
    for (const bi of blockInfo) {
      if (!bi.isCard || bi.isProd || !bi.num) continue
      const ligaNum   = bi.num.toUpperCase()
      const ligaClean = cleanNumber(ligaNum)
      if (ligaClean !== targetNum && !ligaNum.startsWith(targetNum)) continue
      cardHref = bi.href || ''
      break
    }

    let cardPagePrices = null
    if (cardHref) {
      const cardHtml = await get(`https://www.ligapokemon.com.br/?${cardHref}`)
      const raw0 = cardHtml.match(/"0":\{"p":"[^}]+"/)
      const raw2 = cardHtml.match(/"2":\{"p":"[^}]+"/)
      cardPagePrices = { cardHref, raw0: raw0?.[0] ?? null, raw2: raw2?.[0] ?? null, prices: extractPricesFromJS(cardHtml) }
    }

    return NextResponse.json({ targetNum, totalBlocks: blockInfo.length, blockInfo, cardPagePrices })
  }

  const key = `${name}|${number}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json({ ...hit.data, cached: true })
  }

  const data = await scrapeLiga(name, number)
  cache.set(key, { data, ts: Date.now() })
  return NextResponse.json(data)
}
