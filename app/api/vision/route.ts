import { NextResponse } from 'next/server'

const GROQ_KEY = process.env.GROQ_API_KEY || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Llama 4 Scout — modelo gratuito com suporte a visão, 30 req/min free
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'Imagem não fornecida' }, { status: 400 })
    }

    if (!GROQ_KEY) {
      return NextResponse.json({
        error: 'Configure GROQ_API_KEY no .env.local — chave grátis em console.groq.com',
      }, { status: 500 })
    }

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
            {
              type: 'text',
              text:
                'This is a Pokémon TCG card. Reply ONLY with valid JSON, nothing else.\n' +
                '"name": the FULL card name exactly as printed, INCLUDING the variant suffix — e.g. "Lapras V", "Charizard ex", "Pikachu VMAX", "Mewtwo VSTAR", "Gengar GX". Never drop V/ex/EX/VMAX/VSTAR/GX.\n' +
                '"number": ONLY the digits/letters BEFORE the slash at the bottom — e.g. for "SV110/SV122" return "SV110"; for "025/073" return "025"; for "TG01/TG30" return "TG01".\n' +
                '{"name":"...","number":"..."}',
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(12_000),
    })

    const data = await res.json()

    if (data.error) {
      const msg: string = data.error?.message || JSON.stringify(data.error)
      const friendly = msg.includes('quota') || msg.includes('rate')
        ? 'Limite de requests atingido — aguarde alguns segundos'
        : `Erro de visão: ${msg.slice(0, 120)}`
      return NextResponse.json({ error: friendly }, { status: 500 })
    }

    const raw: string = data?.choices?.[0]?.message?.content ?? ''

    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    let cardName: string | null   = null
    let cardNumber: string | null = null

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        cardName   = parsed.name   || null
        cardNumber = parsed.number || null
      } catch { /* ignora parse error */ }
    }

    return NextResponse.json({ cardName, cardNumber, rawText: raw, lines: [raw] })

  } catch (err: any) {
    const msg = err?.message || ''
    return NextResponse.json({
      error: msg.includes('timeout') || err?.name === 'TimeoutError'
        ? 'Timeout — tente novamente'
        : 'Erro ao processar imagem',
    }, { status: 500 })
  }
}
