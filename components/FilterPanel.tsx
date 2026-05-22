'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Package, ChevronDown, Search } from 'lucide-react'

interface Set {
  id: string
  name: string
  series: string
  total: number
  releaseDate: string
  images: { symbol: string; logo: string }
}

interface FilterPanelProps {
  onFiltersChange: (lang: string, setId: string, setName: string) => void
  disabled?: boolean
}

const LANGUAGES = [
  { code: 'en', label: 'Inglês', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ja', label: 'Japonês', flag: '🇯🇵' },
]

export default function FilterPanel({ onFiltersChange, disabled }: FilterPanelProps) {
  const [lang, setLang] = useState('en')
  const [sets, setSets] = useState<Set[]>([])
  const [selectedSet, setSelectedSet] = useState<Set | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/sets?lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        setSets(data.sets || [])
        setSelectedSet(null)
        onFiltersChange(lang, '', '')
      })
      .finally(() => setLoading(false))
  }, [lang])

  const filtered = sets.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.series.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectSet = (set: Set) => {
    setSelectedSet(set)
    setOpen(false)
    setSearchTerm('')
    onFiltersChange(lang, set.id, set.name)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-4"
    >
      {/* Seleção de idioma */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-yellow-400 uppercase tracking-widest mb-3">
          <Globe size={14} />
          Idioma das Cartas
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((l) => (
            <motion.button
              key={l.code}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => !disabled && setLang(l.code)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-200
                ${lang === l.code
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.25)]'
                  : 'border-white/10 bg-white/5 text-white/50 hover:border-white/30 hover:bg-white/10'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="text-2xl">{l.flag}</span>
              <span className="text-xs font-medium">{l.label}</span>
              {lang === l.code && (
                <motion.div
                  layoutId="langIndicator"
                  className="absolute inset-0 rounded-xl border-2 border-yellow-400 pointer-events-none"
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Seleção de set */}
      <div>
        <label className="flex items-center gap-2 text-xs font-semibold text-yellow-400 uppercase tracking-widest mb-3">
          <Package size={14} />
          Set / Expansão
        </label>

        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => !disabled && !loading && setOpen(!open)}
            disabled={disabled || loading}
            className={`
              w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all duration-200
              ${selectedSet
                ? 'border-yellow-400/50 bg-yellow-400/5 text-white'
                : 'border-white/10 bg-white/5 text-white/40'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/30'}
            `}
          >
            <span className="text-sm truncate">
              {loading ? 'Carregando sets...' : selectedSet ? selectedSet.name : 'Selecione o set...'}
            </span>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-white/40 flex-shrink-0" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 w-full mt-2 rounded-xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-black/50 overflow-hidden"
              >
                {/* Search */}
                <div className="p-2 border-b border-white/10">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <Search size={14} className="text-white/30" />
                    <input
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar set..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                    />
                  </div>
                </div>

                {/* Lista */}
                <div className="max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-white/30">Nenhum set encontrado</div>
                  ) : (
                    filtered.map((set) => (
                      <motion.button
                        key={set.id}
                        whileHover={{ backgroundColor: 'rgba(250,204,21,0.08)' }}
                        onClick={() => handleSelectSet(set)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      >
                        <div>
                          <p className="text-sm text-white font-medium">{set.name}</p>
                          <p className="text-xs text-white/40">{set.series} · {set.total} cartas</p>
                        </div>
                        {selectedSet?.id === set.id && (
                          <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
