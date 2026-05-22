'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface PriceBlock { min: number; avg: number; max: number }
interface Card {
  id: string
  name: string
  number: string
  set: { id: string; name: string; series: string }
  images: { small: string; large: string }
  rarity: string
  types: string[]
  hp: string
  prices: { usd: number | null; usdNormal?: number | null; usdFoil?: number | null; cardmarket: number | null }
  ligaNormal?: PriceBlock | null
  ligaFoil?:   PriceBlock | null
  scannedAt: number
}

const TYPE_COLORS: Record<string, string> = {
  Fire: '#ef4444', Water: '#3b82f6', Grass: '#22c55e', Electric: '#eab308',
  Psychic: '#a855f7', Fighting: '#f97316', Darkness: '#6b7280', Metal: '#94a3b8',
  Dragon: '#6366f1', Fairy: '#ec4899', Colorless: '#9ca3af',
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

const RARITY_ACCENT: Record<string, string> = {
  'Rare Holo':                 '168,85,247',
  'Rare Holo EX':              '234,179,8',
  'Rare Ultra':                '250,204,21',
  'Rare Secret':               '236,72,153',
  'Special Illustration Rare': '236,72,153',
  'Hyper Rare':                '250,204,21',
  'Illustration Rare':         '139,92,246',
}

async function fetchBRL(): Promise<number> {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()
    return data?.rates?.BRL ?? 5.7
  } catch { return 5.7 }
}

export default function OverlayPage() {
  const [card, setCard]           = useState<Card | null>(null)
  const [brlRate, setBrlRate]     = useState(5.7)
  const lastIdRef                 = useRef<string | null>(null)
  const lastScannedAtRef          = useRef<number>(0)

  useEffect(() => { fetchBRL().then(setBrlRate) }, [])

  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/current-card')
        const data = await res.json()
        if (data.card) {
          const idChanged  = data.card.id !== lastIdRef.current
          const tsChanged  = (data.card.scannedAt ?? 0) !== lastScannedAtRef.current
          if (idChanged || tsChanged) {
            lastIdRef.current        = data.card.id
            lastScannedAtRef.current = data.card.scannedAt ?? 0
            setCard(data.card)
          }
        } else if (!data.card && lastIdRef.current) {
          lastIdRef.current        = null
          lastScannedAtRef.current = 0
          setCard(null)
        }
      } catch { }
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => clearInterval(iv)
  }, [])

  const accentRgb  = card ? (RARITY_ACCENT[card.rarity] || '250,204,21') : '250,204,21'
  const typeClr    = card?.types?.[0] ? (TYPE_COLORS[card.types[0]] || '#facc15') : '#facc15'
  const typeRgb    = hexToRgb(typeClr)
  const usd        = card?.prices?.usd ?? null
  const brl        = usd ? usd * brlRate : null
  const ligaNormal = card?.ligaNormal ?? null
  const ligaFoil   = card?.ligaFoil   ?? null
  const brPrice    = ligaNormal?.avg ?? ligaFoil?.avg ?? brl

  const hasLiga    = !!(ligaNormal || ligaFoil)
  const hasPrices  = !!(brPrice || ligaNormal || ligaFoil || usd || card?.prices.cardmarket)

  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center pointer-events-none overflow-hidden">
      <AnimatePresence mode="wait">
        {card && (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 70, scale: 0.88 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 40, scale: 0.93 }}
            transition={{ duration: 0.6, type: 'spring', bounce: 0.18 }}
            className="relative w-[780px]"
          >
            {/* ── Painel ── */}
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: '#080808',
                border:    `1px solid rgba(${accentRgb},0.30)`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.95), 0 8px 20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Fundo ambiente: gradiente baseado na COR DO TIPO (sempre preciso) */}
              <div className="absolute inset-0" style={{
                background: [
                  `radial-gradient(ellipse 55% 80% at 12% 50%, rgba(${typeRgb},0.40) 0%, transparent 100%)`,
                  `radial-gradient(ellipse 45% 70% at 88% 50%, rgba(${accentRgb},0.22) 0%, transparent 100%)`,
                ].join(', '),
              }} />
              {/* Textura sutil da arte da carta — opacidade baixa para não vazar cor errada */}
              {card.images?.large && (
                <div className="absolute inset-0" style={{
                  backgroundImage: `url(${card.images.large})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(60px) saturate(1.1)',
                  transform: 'scale(1.5)',
                  opacity: 0.10,
                }} />
              )}
              {/* Overlay escuro */}
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.82)' }} />

              {/* Linha de cor do tipo no topo */}
              <div className="relative z-10 h-[3px]" style={{
                background: `linear-gradient(90deg, transparent 0%, ${typeClr} 25%, rgba(${accentRgb},0.9) 50%, ${typeClr} 75%, transparent 100%)`,
              }} />

              <div className="relative z-10 flex gap-8 p-8">

                {/* ── Imagem da carta ── */}
                <motion.div
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0,   opacity: 1 }}
                  transition={{ duration: 0.75, delay: 0.15, type: 'spring' }}
                  style={{ perspective: 900, flexShrink: 0 }}
                >
                  {card.images?.large ? (
                    <Image
                      src={card.images.large}
                      alt={card.name}
                      width={220}
                      height={308}
                      className="rounded-2xl"
                      style={{
                        filter:    'drop-shadow(0 6px 24px rgba(0,0,0,0.85))',
                        maxHeight: '308px',
                        width:     'auto',
                      }}
                      unoptimized
                      priority
                    />
                  ) : (
                    <div className="w-[220px] h-[308px] rounded-2xl bg-white/5 flex items-center justify-center">
                      <span className="text-white/20 text-4xl">🃏</span>
                    </div>
                  )}
                </motion.div>

                {/* ── Info ── */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">

                  {/* Nome + set + badges */}
                  <div className="space-y-3">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 }}>
                      <h1 className="text-[2.6rem] font-black text-white leading-tight tracking-tight">
                        {card.name}
                      </h1>
                      <p className="text-sm text-white/35 mt-1 font-medium">
                        {card.set.name} &nbsp;·&nbsp; #{card.number}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.38 }}
                      className="flex flex-wrap gap-2"
                    >
                      {card.types?.map(t => (
                        <span key={t}
                          className="text-xs px-3 py-1 rounded-full font-bold tracking-wide"
                          style={{
                            backgroundColor: `${TYPE_COLORS[t] || '#facc15'}20`,
                            color:           TYPE_COLORS[t] || '#facc15',
                            border:          `1px solid ${TYPE_COLORS[t] || '#facc15'}45`,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                      {card.hp && (
                        <span className="text-xs px-3 py-1 rounded-full bg-white/6 border border-white/12 text-white/45 font-semibold">
                          {card.hp} HP
                        </span>
                      )}
                      {card.rarity && (
                        <span className="text-xs px-3 py-1 rounded-full bg-white/4 border border-white/8 text-white/28 max-w-[220px] truncate">
                          {card.rarity}
                        </span>
                      )}
                    </motion.div>
                  </div>

                  {/* ── Preços ── */}
                  {hasPrices && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0  }}
                      transition={{ delay: 0.5 }}
                      className="mt-5 pt-5 border-t border-white/[0.06] space-y-2"
                    >
                      <p className="text-[9px] text-white/22 uppercase tracking-[0.18em]">Valor de mercado</p>

                      {hasLiga ? (
                        <div className="flex flex-col gap-2">
                          {/* Normal */}
                          {ligaNormal && (
                            <div className="rounded-2xl px-5 py-3"
                              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)' }}>
                              <p className="text-[9px] text-green-400/55 uppercase tracking-widest mb-1.5">🇧🇷 Liga · Normal</p>
                              <div className="flex gap-4 text-center">
                                <div className="flex-1">
                                  <p className="text-[8px] text-green-300/65 uppercase mb-0.5">Mín</p>
                                  <p className="text-lg font-bold text-green-300/90">R${ligaNormal.min.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div className="flex-1 border-x border-green-500/12">
                                  <p className="text-[8px] text-green-400/65 uppercase mb-0.5">Méd</p>
                                  <p className="text-3xl font-black text-green-400 leading-none">
                                    R${ligaNormal.avg.toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                                <div className="flex-1">
                                  <p className="text-[8px] text-green-300/65 uppercase mb-0.5">Máx</p>
                                  <p className="text-lg font-bold text-green-300/90">R${ligaNormal.max.toFixed(2).replace('.', ',')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Foil */}
                          {ligaFoil && (
                            <div className="rounded-2xl px-5 py-3"
                              style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
                              <p className="text-[9px] text-purple-400/55 uppercase tracking-widest mb-1.5">✨ Liga · Foil</p>
                              <div className="flex gap-4 text-center">
                                <div className="flex-1">
                                  <p className="text-[8px] text-purple-300/65 uppercase mb-0.5">Mín</p>
                                  <p className="text-lg font-bold text-purple-300/90">R${ligaFoil.min.toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div className="flex-1 border-x border-purple-500/12">
                                  <p className="text-[8px] text-purple-400/65 uppercase mb-0.5">Méd</p>
                                  <p className="text-3xl font-black text-purple-400 leading-none">
                                    R${ligaFoil.avg.toFixed(2).replace('.', ',')}
                                  </p>
                                </div>
                                <div className="flex-1">
                                  <p className="text-[8px] text-purple-300/65 uppercase mb-0.5">Máx</p>
                                  <p className="text-lg font-bold text-purple-300/90">R${ligaFoil.max.toFixed(2).replace('.', ',')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Fallback USD / BRL estimado */
                        <div className="flex gap-3">
                          {usd && (
                            <div className="flex-1 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.14)' }}>
                              <p className="text-[9px] text-green-400/45 uppercase tracking-widest mb-0.5">TCGPlayer</p>
                              <p className="text-3xl font-black text-green-400 leading-none">${usd.toFixed(2)}</p>
                            </div>
                          )}
                          {brPrice && (
                            <div className="flex-1 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.14)' }}>
                              <p className="text-[9px] text-cyan-400/45 uppercase tracking-widest mb-0.5">Em Reais (est.)</p>
                              <p className="text-3xl font-black text-cyan-400 leading-none">R${brPrice.toFixed(2).replace('.', ',')}</p>
                            </div>
                          )}
                          {!usd && card.prices.cardmarket && (
                            <div className="flex-1 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)' }}>
                              <p className="text-[9px] text-blue-400/45 uppercase tracking-widest mb-0.5">Cardmarket</p>
                              <p className="text-3xl font-black text-blue-400 leading-none">€{card.prices.cardmarket.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Branding */}
              <div className="relative z-10 px-8 pb-5 flex justify-end">
                <span className="text-[9px] text-white/8 tracking-[0.2em] uppercase">PokéScan TCG</span>
              </div>

              {/* Efeito holográfico animado — muito sutil */}
              <motion.div
                animate={{ x: ['-130%', '230%'] }}
                transition={{ repeat: Infinity, duration: 6, ease: 'linear', delay: 1.5 }}
                className="absolute inset-0 z-20 pointer-events-none"
                style={{
                  background: `linear-gradient(108deg, transparent 38%, rgba(255,255,255,0.025) 48%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.025) 52%, transparent 62%)`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
