import { Redis } from '@upstash/redis'

export interface CardData {
  id: string
  name: string
  number: string
  set: { id: string; name: string; series: string }
  images: { small: string; large: string }
  rarity: string
  types: string[]
  hp: string
  prices: { usd: number | null; cardmarket: number | null }
  ligaNormal?: { min: number; avg: number; max: number } | null
  ligaFoil?:   { min: number; avg: number; max: number } | null
  scannedAt: number
}

const CARD_KEY = 'pokescan:current-card'

// Usa Redis se as env vars estiverem configuradas, senão cai para in-memory (dev local)
const isRedisConfigured =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN

const redis = isRedisConfigured
  ? new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Fallback em memória para desenvolvimento local
let localCard: CardData | null = null

export async function setCurrentCard(card: CardData): Promise<void> {
  const data = { ...card, scannedAt: Date.now() }
  if (redis) {
    await redis.set(CARD_KEY, JSON.stringify(data), { ex: 3600 }) // expira em 1h
  } else {
    localCard = data
  }
}

export async function getCurrentCard(): Promise<CardData | null> {
  if (redis) {
    const raw = await redis.get<string>(CARD_KEY)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as CardData)
  }
  return localCard
}

export async function clearCurrentCard(): Promise<void> {
  if (redis) {
    await redis.del(CARD_KEY)
  } else {
    localCard = null
  }
}
