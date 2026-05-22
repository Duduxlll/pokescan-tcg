'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, DollarSign, Hash, Package, ChevronDown, ChevronUp, ExternalLink, RotateCcw } from 'lucide-react'
import Image from 'next/image'

interface Card {
  id: string
  name: string
  number: string
  set: { id: string; name: string; series: string }
  images: { small: string; large: string }
  rarity: string
  types: string[]
  hp: string
  prices: { usd: number | null; cardmarket: number | null }
}

interface CardResultProps {
  cards: Card[]
  onReset: () => void
}

const TYPE_COLORS: Record<string, string> = {
  Fire: '#ef4444', Water: '#3b82f6', Grass: '#22c55e', Electric: '#eab308',
  Psychic: '#a855f7', Fighting: '#f97316', Darkness: '#6b7280', Metal: '#94a3b8',
  Dragon: '#6366f1', Fairy: '#ec4899', Colorless: '#9ca3af',
}

const RARITY_GLOW: Record<string, string> = {
  'Common': 'rgba(148,163,184,0.3)',
  'Uncommon': 'rgba(34,197,94,0.3)',
  'Rare': 'rgba(59,130,246,0.4)',
  'Rare Holo': 'rgba(168,85,247,0.5)',
  'Rare Holo EX': 'rgba(234,179,8,0.6)',
  'Rare Ultra': 'rgba(250,204,21,0.7)',
  'Rare Secret': 'rgba(236,72,153,0.7)',
  'Special Illustration Rare': 'rgba(236,72,153,0.8)',
}

function PriceTag({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className="text-lg font-bold text-yellow-400">
        {currency}{value.toFixed(2)}
      </span>
    </div>
  )
}

function CardItem({ card, index }: { card: Card; index: number }) {
  const [flipped, setFlipped] = useState(false)
  const glow = RARITY_GLOW[card.rarity] || 'rgba(250,204,21,0.2)'
  const typeColor = card.types?.[0] ? (TYPE_COLORS[card.types[0]] || '#facc15') : '#facc15'
  const hasPrices = card.prices.usd || card.prices.cardmarket

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, type: 'spring', bounce: 0.3 }}
      className="relative rounded-2xl border border-white/10 bg-[#0d0d1e] overflow-hidden"
      style={{ boxShadow: `0 8px 40px ${glow}` }}
    >
      {/* Header holográfico */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${typeColor}, transparent)` }}
      />

      <div className="p-4">
        <div className="flex gap-4">
          {/* Imagem da carta */}
          <motion.div
            whileHover={{ scale: 1.05, rotateY: 5 }}
            transition={{ duration: 0.3 }}
            className="relative flex-shrink-0 w-28 cursor-pointer"
            onClick={() => setFlipped(!flipped)}
            style={{ perspective: 600 }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              className="relative"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {card.images?.large ? (
                <Image
                  src={card.images.large}
                  alt={card.name}
                  width={180}
                  height={252}
                  className="w-full rounded-xl shadow-xl"
                  style={{ filter: `drop-shadow(0 0 12px ${glow})` }}
                  unoptimized
                />
              ) : (
                <div className="w-28 h-40 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-white/20 text-xs">Sem imagem</span>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Nome + rarity */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-base font-bold text-white leading-tight">{card.name}</h3>
              {card.rarity && (
                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/40">
                  {card.rarity}
                </span>
              )}
            </div>

            {/* Tipos */}
            {card.types?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {card.types.map((type) => (
                  <span
                    key={type}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${TYPE_COLORS[type] || '#facc15'}22`, color: TYPE_COLORS[type] || '#facc15', border: `1px solid ${TYPE_COLORS[type] || '#facc15'}44` }}
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}

            {/* Dados */}
            <div className="space-y-1">
              {card.hp && (
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Star size={10} style={{ color: typeColor }} />
                  <span>HP: <span className="text-white/80">{card.hp}</span></span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Hash size={10} className="text-yellow-400" />
                <span>Nº <span className="text-white/80">{card.number}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Package size={10} className="text-yellow-400" />
                <span className="truncate text-white/60">{card.set.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preços */}
        {hasPrices && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1">
              <DollarSign size={10} />
              Valor de Mercado
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PriceTag label="TCGPlayer" value={card.prices.usd} currency="$" />
              <PriceTag label="Cardmarket" value={card.prices.cardmarket} currency="€" />
            </div>
          </div>
        )}

        {!hasPrices && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-white/20 text-center">Preço não disponível nesta API</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function CardResult({ cards, onReset }: CardResultProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? cards : cards.slice(0, 2)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">
            {cards.length === 1 ? 'Carta encontrada' : `${cards.length} cartas encontradas`}
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            {cards.length > 1 ? 'Selecione a carta correta' : 'Toque na carta para ver em detalhe'}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/50 text-xs hover:text-white hover:bg-white/10 transition-all"
        >
          <RotateCcw size={12} />
          Nova Leitura
        </motion.button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {visible.map((card, i) => (
          <CardItem key={card.id} card={card} index={i} />
        ))}
      </div>

      {/* Mostrar mais */}
      {cards.length > 2 && (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white hover:border-white/20 transition-all"
        >
          {showAll ? (
            <><ChevronUp size={14} /> Mostrar menos</>
          ) : (
            <><ChevronDown size={14} /> Ver mais {cards.length - 2} resultado(s)</>
          )}
        </motion.button>
      )}
    </motion.div>
  )
}
