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
  scannedAt: number
}

// Store global em memória — persiste enquanto o servidor estiver rodando
let currentCard: CardData | null = null

export function setCurrentCard(card: CardData) {
  currentCard = { ...card, scannedAt: Date.now() }
}

export function getCurrentCard(): CardData | null {
  return currentCard
}

export function clearCurrentCard() {
  currentCard = null
}
