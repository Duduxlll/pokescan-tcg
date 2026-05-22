import { createClient } from '@libsql/client'

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

const isTursoConfigured =
  process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN

// Fallback em memória para desenvolvimento local (sem Turso configurado)
let localCard: CardData | null = null

function getClient() {
  if (!isTursoConfigured) return null
  return createClient({
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  })
}

async function ensureTable(db: ReturnType<typeof createClient>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS current_card (
      id      TEXT PRIMARY KEY DEFAULT 'singleton',
      data    TEXT,
      updated INTEGER
    )
  `)
}

export async function setCurrentCard(card: CardData): Promise<void> {
  const data = { ...card, scannedAt: Date.now() }
  const db = getClient()
  if (db) {
    await ensureTable(db)
    await db.execute({
      sql: `INSERT INTO current_card (id, data, updated)
            VALUES ('singleton', ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated`,
      args: [JSON.stringify(data), data.scannedAt],
    })
  } else {
    localCard = data
  }
}

export async function getCurrentCard(): Promise<CardData | null> {
  const db = getClient()
  if (db) {
    await ensureTable(db)
    const result = await db.execute(
      `SELECT data FROM current_card WHERE id = 'singleton' LIMIT 1`
    )
    const row = result.rows[0]
    if (!row?.data) return null
    return JSON.parse(row.data as string) as CardData
  }
  return localCard
}

export async function clearCurrentCard(): Promise<void> {
  const db = getClient()
  if (db) {
    await ensureTable(db)
    await db.execute(`DELETE FROM current_card WHERE id = 'singleton'`)
  } else {
    localCard = null
  }
}
