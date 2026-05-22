'use client'

import {
  useState, useRef, useCallback, useEffect
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Camera, Zap, RefreshCw, Play, Square,
  AlertTriangle, CheckCircle2, Loader2, ChevronDown,
  Search, Tv2, Package, Video, RotateCw
} from 'lucide-react'
import Image from 'next/image'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PriceBlock { min: number; avg: number; max: number }
interface Card {
  id: string; name: string; number: string
  set: { id: string; name: string; series: string }
  images: { small: string; large: string }
  rarity: string; types: string[]; hp: string
  prices: {
    usd: number | null
    usdNormal: number | null
    usdFoil: number | null
    cardmarket: number | null
    cardmarketLow: number | null
  }
  ligaNormal?: PriceBlock | null
  ligaFoil?:   PriceBlock | null
}

interface SetItem { id: string; name: string; series: string; total: number }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Fire: '#ef4444', Water: '#3b82f6', Grass: '#22c55e', Electric: '#eab308',
  Psychic: '#a855f7', Fighting: '#f97316', Darkness: '#6b7280', Metal: '#94a3b8',
  Dragon: '#6366f1', Fairy: '#ec4899', Colorless: '#9ca3af',
}

const RARITY_GLOW: Record<string, string> = {
  'Rare Holo': 'rgba(168,85,247,0.55)',
  'Rare Holo EX': 'rgba(234,179,8,0.65)',
  'Rare Ultra': 'rgba(250,204,21,0.75)',
  'Rare Secret': 'rgba(236,72,153,0.75)',
  'Special Illustration Rare': 'rgba(236,72,153,0.85)',
}


// ─── Componente de Dropdown genérico (position: fixed → não corta) ────────────
// O listener de "fechar ao clicar fora" usa o ref do próprio dropdown para
// verificar se o clique foi interno — isso funciona mesmo com eventos nativos
// do DOM que o React não intercepta no document.

function DropdownMenu({
  open, anchorRef, onClose, children, width = 280,
}: {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Calcula posição quando abre
  useEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const left = Math.min(r.left, window.innerWidth - width - 8)
      setPos({ top: r.bottom + 6, left: Math.max(8, left) })
    }
  }, [open, anchorRef, width])

  // Fecha ao clicar fora — verifica se o alvo está no dropdown OU no botão
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const insideAnchor   = anchorRef.current?.contains(target)
      const insideDropdown = dropdownRef.current?.contains(target)
      if (!insideAnchor && !insideDropdown) onClose()
    }
    // Delay mínimo para não capturar o próprio clique que abriu o dropdown
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 80)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [open]) // sem onClose/anchorRef nas deps — usamos refs, são estáveis

  if (!open) return null

  return (
    <div ref={dropdownRef} className="fixed z-[9999]" style={{ top: pos.top, left: pos.left, width }}>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="rounded-xl border border-white/10 bg-[#0d0d1c] shadow-2xl shadow-black/70 overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function StreamPage() {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastIdRef = useRef<string | null>(null)
  const coolRef   = useRef(false)
  const analyzingRef = useRef(false)

  // Refs dos botões para os dropdowns com posição fixed
  const camBtnRef  = useRef<HTMLButtonElement>(null)
  const setBtnRef  = useRef<HTMLButtonElement>(null)

  // ── Estado câmera ──
  const [cameras, setCameras]         = useState<MediaDeviceInfo[]>([])
  const [selCamera, setSelCamera]     = useState<string>('')
  const [cameraActive, setCameraActive] = useState(false)
  const [camOpen, setCamOpen]         = useState(false)
  const [rotation, setRotation]       = useState<0 | 90 | 180 | 270>(0)

  // ── Estado filtros ──
  const [setId, setSetId]       = useState('')
  const [setName, setSetName]   = useState('')
  const [sets, setSets]         = useState<SetItem[]>([])
  const [setSearch, setSetSearch] = useState('')
  const [setOpen, setSetOpen]   = useState(false)
  const [setsLoading, setSetsLoading] = useState(false)

  // ── Estado scan ──
  const [autoMode, setAutoMode]     = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [statusKind, setStatusKind] = useState<'idle'|'scanning'|'found'|'error'>('idle')
  const [statusMsg, setStatusMsg]   = useState('Aguardando câmera...')
  const [card, setCard]             = useState<Card | null>(null)
  const [suggestions, setSuggestions] = useState<Card[]>([])
  const [shownSuggCount, setShownSuggCount] = useState(5)
  const [flash, setFlash]           = useState(false)
  const [brlRate, setBrlRate]       = useState(5.7)

  // ── Taxa de câmbio USD→BRL ──
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => { if (d?.rates?.BRL) setBrlRate(d.rates.BRL) })
      .catch(() => {})
  }, [])

  // ── Enumerar câmeras ──
  const enumerateCameras = useCallback(async () => {
    // Tenta pedir permissão para obter os labels — mas mesmo que falhe, ainda lista os devices
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach(t => t.stop())
    } catch { /* permissão não concedida ainda — tudo bem, labels ficam genéricos */ }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const vids = devices.filter(d => d.kind === 'videoinput')
      setCameras(vids)
      if (vids.length > 0 && !selCamera) setSelCamera(vids[0].deviceId)
      if (vids.length === 0) setStatusMsg('Nenhuma câmera detectada pelo navegador.')
    } catch {
      setStatusMsg('Não foi possível acessar os dispositivos de câmera.')
    }
  }, [selCamera])

  useEffect(() => { enumerateCameras() }, [])

  // ── Carregar sets ──
  useEffect(() => {
    setSetsLoading(true)
    setSetId('')
    setSetName('')
    fetch('/api/sets')
      .then(r => r.json())
      .then(d => setSets(d.sets || []))
      .finally(() => setSetsLoading(false))
  }, [])

  // ── Ligar câmera ──
  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selCamera ? { exact: selCamera } : undefined,
          width: { ideal: 1920 }, height: { ideal: 1080 },
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      setStatusKind('idle')
      setStatusMsg('Câmera ativa — pronto para escanear')
    } catch {
      setStatusKind('error')
      setStatusMsg('Não foi possível acessar a câmera selecionada.')
    }
  }, [selCamera])

  // ── Desligar câmera ──
  const stopCamera = useCallback(() => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
    setAutoMode(false)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
    setStatusKind('idle')
    setStatusMsg('Câmera desligada')
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Trocar câmera ──
  const switchCamera = useCallback(async (deviceId: string) => {
    setSelCamera(deviceId)
    setCamOpen(false)
    if (cameraActive) {
      stopCamera()
      // pequeno delay antes de religar com a nova câmera
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          })
          streamRef.current = stream
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
          setCameraActive(true)
          setStatusKind('idle')
          setStatusMsg('Câmera trocada com sucesso')
        } catch {
          setStatusKind('error')
          setStatusMsg('Erro ao trocar câmera')
        }
      }, 300)
    }
  }, [cameraActive, stopCamera])

  // ── Capturar e analisar ──
  const captureAndAnalyze = useCallback(async (forceManual = false) => {
    if (!videoRef.current || !canvasRef.current) return
    if (analyzingRef.current) return
    // Manual sempre ignora cooldown; auto-scan respeita
    if (!forceManual && coolRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const rotated = rotation === 90 || rotation === 270

    // Para 90°/270° o canvas troca largura e altura
    canvas.width  = rotated ? vh : vw
    canvas.height = rotated ? vw : vh

    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(video, -vw / 2, -vh / 2)
    ctx.restore()

    setFlash(true)
    setTimeout(() => setFlash(false), 180)

    analyzingRef.current = true
    setAnalyzing(true)
    setStatusKind('scanning')
    setStatusMsg('Lendo texto da carta...')

    try {
      // Reduz a imagem para max 1200px — resolução suficiente para ler números pequenos
      const MAX_W = 1200
      let imageBase64: string
      if (canvas.width > MAX_W) {
        const thumb = document.createElement('canvas')
        const scale = MAX_W / canvas.width
        thumb.width  = MAX_W
        thumb.height = Math.round(canvas.height * scale)
        thumb.getContext('2d')!.drawImage(canvas, 0, 0, thumb.width, thumb.height)
        imageBase64 = thumb.toDataURL('image/jpeg', 0.85)
      } else {
        imageBase64 = canvas.toDataURL('image/jpeg', 0.85)
      }

      const vRes  = await fetch('/api/vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })
      const vData = await vRes.json()

      if (vData.error) {
        setStatusKind('error')
        setStatusMsg(`Erro: ${vData.error}`)
        // Cooldown em caso de erro
        coolRef.current = true
        setTimeout(() => { coolRef.current = false }, 6000)
        return
      }

      if (!vData.cardName && !vData.cardNumber) {
        const lidas = vData.lines?.slice(0, 3).join(' | ') || '(sem texto)'
        setStatusKind('error')
        setStatusMsg(`Nenhum nome/número detectado. Lido: "${lidas}"`)
        return
      }

      setStatusMsg(`Identificado: "${vData.cardName}" — buscando...`)

      const params = new URLSearchParams()
      if (vData.cardName)   params.set('name',  vData.cardName)
      if (vData.cardNumber) params.set('number', vData.cardNumber)
      if (setId)            params.set('setId',  setId)

      const cRes  = await fetch(`/api/cards?${params}`)
      const cData = await cRes.json()

      if (!cData.cards?.length) {
        setStatusKind('error')
        setStatusMsg(`Nenhuma carta encontrada para "${vData.cardName}"`)
        return
      }

      const found: Card = cData.cards[0]

      if (found.id === lastIdRef.current) {
        setStatusKind('found')
        setStatusMsg(`✓ ${found.name} · ${found.set.name}`)
        coolRef.current = true
        setTimeout(() => { coolRef.current = false }, 2500)
        return
      }

      // Guarda todas as sugestões disponíveis (até 11 extras)
      setSuggestions(cData.cards.slice(1))
      setShownSuggCount(5)

      // Busca preço Liga Pokémon em paralelo
      fetch(`/api/price-liga?name=${encodeURIComponent(found.name)}&number=${encodeURIComponent(found.number)}`)
        .then(r => r.json())
        .then(liga => {
          const hasData = liga.normal || liga.foil
          if (hasData) {
            const cardWithLiga = { ...found, ligaNormal: liga.normal ?? null, ligaFoil: liga.foil ?? null }
            setCard(cardWithLiga)
            fetch('/api/current-card', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cardWithLiga),
            }).catch(() => {})
          }
        })
        .catch(() => {})

      lastIdRef.current = found.id
      setCard(found)
      setStatusKind('found')
      setStatusMsg(`✓ ${found.name} · ${found.set.name}`)

      await fetch('/api/current-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(found),
      })

      // Cooldown de 3s após novo resultado
      coolRef.current = true
      setTimeout(() => { coolRef.current = false }, 3000)

    } catch {
      setStatusKind('error')
      setStatusMsg('Erro de conexão — verifique a internet')
    } finally {
      analyzingRef.current = false
      setAnalyzing(false)
    }
  }, [setId, rotation])

  // ── Auto scan ──
  const startAuto = useCallback(() => {
    if (autoRef.current) return
    setAutoMode(true)
    captureAndAnalyze()
    // 4s entre scans = ~15 req/min, dentro do limite do Groq (30 RPM)
    autoRef.current = setInterval(captureAndAnalyze, 4000)
  }, [captureAndAnalyze])

  const stopAuto = useCallback(() => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
    setAutoMode(false)
    setStatusMsg('Auto-scan pausado')
  }, [])

  // ── Limpar carta ──
  const clearCard = useCallback(async () => {
    setCard(null)
    setSuggestions([])
    lastIdRef.current = null
    await fetch('/api/current-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    })
    setStatusMsg('Carta limpa')
  }, [])

  // ── Selecionar sugestão ──
  const selectSuggestion = useCallback(async (chosen: Card) => {
    lastIdRef.current = chosen.id
    setCard(chosen)
    setSuggestions([])
    setShownSuggCount(5)
    setStatusKind('found')
    setStatusMsg(`✓ ${chosen.name} · ${chosen.set.name}`)
    // Busca preço Liga para a sugestão escolhida
    fetch(`/api/price-liga?name=${encodeURIComponent(chosen.name)}&number=${encodeURIComponent(chosen.number)}`)
      .then(r => r.json())
      .then(liga => {
        if (liga.normal || liga.foil) {
          const withLiga = { ...chosen, ligaNormal: liga.normal ?? null, ligaFoil: liga.foil ?? null }
          setCard(withLiga)
          fetch('/api/current-card', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withLiga),
          }).catch(() => {})
        }
      }).catch(() => {})
    await fetch('/api/current-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chosen),
    })
  }, [])

  const filteredSets = sets.filter(s => {
    if (!setSearch) return true
    const q = setSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.series.toLowerCase().includes(q)
  })

  const glow     = card ? (RARITY_GLOW[card.rarity] || 'rgba(250,204,21,0.3)') : 'rgba(250,204,21,0.15)'
  const typeClr  = card?.types?.[0] ? (TYPE_COLORS[card.types[0]] || '#facc15') : '#facc15'
  const selCamLabel = cameras.find(c => c.deviceId === selCamera)?.label || 'Selecionar câmera'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-[#060610] text-white overflow-hidden flex flex-col select-none">

      {/* ── Fundo estático (sem animação = sem jank) ── */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: [
          'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(250,204,21,0.06) 0%, transparent 100%)',
          'radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.04) 0%, transparent 100%)',
          '#060610',
        ].join(', '),
      }} />

      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-50 flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b border-white/[0.07]"
        style={{ background: 'rgba(6,6,16,0.85)', backdropFilter: 'blur(20px)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2 mr-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#facc15,#f97316)', boxShadow: '0 0 14px rgba(250,204,21,0.35)' }}>
            <Sparkles size={14} className="text-black" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-[13px] bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent tracking-tight">
              PokéScan TCG
            </span>
            <span className="text-[8px] text-white/20 uppercase tracking-[0.15em]">Live Scanner</span>
          </div>
        </div>

        <div className="w-px h-6 bg-white/8 mx-1" />

        {/* Seletor câmera */}
        <div className="flex items-center gap-1.5">
          <Video size={12} className="text-white/25 flex-shrink-0" />
          <button ref={camBtnRef}
            onClick={() => { enumerateCameras(); setCamOpen(!camOpen); setSetOpen(false) }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-all max-w-[180px] ${
              camOpen ? 'border-yellow-400/50 bg-yellow-400/8 text-yellow-300'
                      : 'border-white/8 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/80'
            }`}>
            <span className="truncate">{selCamLabel.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Câmera...'}</span>
            <motion.div animate={{ rotate: camOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown size={10} />
            </motion.div>
          </button>
        </div>

        <div className="w-px h-6 bg-white/8 mx-1" />

        {/* Seletor set */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Package size={12} className="text-white/25 flex-shrink-0" />
          <button ref={setBtnRef}
            onClick={() => { setSetOpen(!setOpen); setCamOpen(false) }}
            disabled={setsLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-all max-w-[200px] disabled:opacity-40 ${
              setOpen ? 'border-yellow-400/50 bg-yellow-400/8 text-yellow-300'
              : setId  ? 'border-yellow-400/25 bg-yellow-400/4 text-yellow-300/80'
                       : 'border-white/8 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/80'
            }`}>
            <span className="truncate">{setsLoading ? 'Carregando...' : (setName || 'Todos os sets')}</span>
            <motion.div animate={{ rotate: setOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown size={10} />
            </motion.div>
          </button>
          {setId && (
            <button onClick={() => { setSetId(''); setSetName('') }}
              className="w-4 h-4 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/30 hover:text-white/60 transition-all text-[9px]">✕</button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a href="/overlay" target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-400/25 bg-violet-400/5 text-violet-300/80 text-[11px] hover:bg-violet-400/10 hover:border-violet-400/40 hover:text-violet-300 transition-all">
            <Tv2 size={11} />
            <span>OBS Overlay</span>
          </a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DROPDOWNS (fixed, fora de qualquer overflow)
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Dropdown câmeras */}
      <DropdownMenu open={camOpen} anchorRef={camBtnRef} onClose={() => setCamOpen(false)} width={280}>
        <div className="p-2">
          <p className="text-[10px] text-white/25 uppercase tracking-widest px-2 mb-2">Câmeras disponíveis</p>
          {cameras.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-white/30">Nenhuma câmera encontrada</p>
              <button onClick={enumerateCameras} className="mt-2 text-xs text-yellow-400 hover:underline">Tentar novamente</button>
            </div>
          ) : cameras.map(cam => (
            <button key={cam.deviceId} onClick={() => switchCamera(cam.deviceId)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                selCamera === cam.deviceId ? 'bg-yellow-400/10 text-yellow-300' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Camera size={13} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {cam.label?.replace(/\s*\(.*?\)\s*/g, '').trim() || `Câmera ${cameras.indexOf(cam) + 1}`}
                </p>
                {cam.label && <p className="text-[10px] text-white/25 truncate">{cam.deviceId.slice(0, 16)}...</p>}
              </div>
              {selCamera === cam.deviceId && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownMenu>

      {/* Dropdown sets */}
      <DropdownMenu open={setOpen} anchorRef={setBtnRef} onClose={() => { setSetOpen(false); setSetSearch('') }} width={300}>
        {/* Search */}
        <div className="p-2 border-b border-white/8">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/8">
            <Search size={12} className="text-white/30 flex-shrink-0" />
            <input
              autoFocus
              value={setSearch}
              onChange={e => setSetSearch(e.target.value)}
              placeholder="Buscar set ou série..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 outline-none"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {/* Opção "todos" */}
          <button
            onClick={() => { setSetId(''); setSetName(''); setSetOpen(false); setSetSearch('') }}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${!setId ? 'text-yellow-300' : 'text-white/40'}`}
          >
            <span className="text-xs">Todos os sets</span>
            {!setId && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
          </button>

          {setsLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-white/30">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Carregando sets...</span>
            </div>
          ) : filteredSets.length === 0 ? (
            <p className="text-center text-xs text-white/25 py-6">Nenhum set encontrado</p>
          ) : filteredSets.map(s => (
            <button
              key={s.id}
              onClick={() => { setSetId(s.id); setSetName(s.name); setSetOpen(false); setSetSearch('') }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-yellow-400/6 ${setId === s.id ? 'bg-yellow-400/8' : ''}`}
            >
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${setId === s.id ? 'text-yellow-300' : 'text-white'}`}>{s.name}</p>
                <p className="text-[10px] text-white/30">{s.series} · {s.total} cartas</p>
              </div>
              {setId === s.id && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      </DropdownMenu>

      {/* ══════════════════════════════════════════════════════════════════════
          ÁREA PRINCIPAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">

        {/* ── Câmera (esquerda) ── */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          <div className="relative flex-1 rounded-2xl overflow-hidden min-h-0"
            style={{
              background: '#000',
              border: cameraActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
              boxShadow: cameraActive ? 'inset 0 0 60px rgba(0,0,0,0.8)' : 'none',
            }}>

            <video ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-500 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: `rotate(${rotation}deg)${(rotation === 90 || rotation === 270) ? ' scale(0.75)' : ''}`, transition: 'transform 0.3s ease, opacity 0.5s' }}
              muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {/* Placeholder */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                <motion.div
                  animate={{ opacity: [0.12, 0.28, 0.12] }}
                  transition={{ repeat: Infinity, duration: 3.5 }}>
                  <div className="w-20 h-20 rounded-2xl border border-white/8 flex items-center justify-center bg-white/3">
                    <Camera size={36} className="text-white/20" />
                  </div>
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-white/25 font-medium">Câmera desligada</p>
                  <p className="text-xs text-white/12">Selecione uma câmera e clique em <span className="text-white/30">Ligar</span></p>
                </div>
              </div>
            )}

            {/* Scanner overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Cantos do scanner */}
                <div className="absolute inset-10">
                  {/* Topo-esquerda */}
                  <div className="absolute top-0 left-0">
                    <div className="absolute top-0 left-0 w-8 h-[3px] rounded-full"
                      style={{ background: 'linear-gradient(90deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute top-0 left-0 h-8 w-[3px] rounded-full"
                      style={{ background: 'linear-gradient(180deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-yellow-400"
                      style={{ boxShadow: '0 0 10px rgba(250,204,21,0.9), 0 0 20px rgba(250,204,21,0.4)' }} />
                  </div>
                  {/* Topo-direita */}
                  <div className="absolute top-0 right-0">
                    <div className="absolute top-0 right-0 w-8 h-[3px] rounded-full"
                      style={{ background: 'linear-gradient(270deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute top-0 right-0 h-8 w-[3px] rounded-full"
                      style={{ background: 'linear-gradient(180deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-yellow-400"
                      style={{ boxShadow: '0 0 10px rgba(250,204,21,0.9), 0 0 20px rgba(250,204,21,0.4)' }} />
                  </div>
                  {/* Baixo-esquerda */}
                  <div className="absolute bottom-0 left-0">
                    <div className="absolute bottom-0 left-0 w-8 h-[3px] rounded-full"
                      style={{ background: 'linear-gradient(90deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute bottom-0 left-0 h-8 w-[3px] rounded-full"
                      style={{ background: 'linear-gradient(0deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute bottom-0 left-0 w-2 h-2 rounded-full bg-yellow-400"
                      style={{ boxShadow: '0 0 10px rgba(250,204,21,0.9), 0 0 20px rgba(250,204,21,0.4)' }} />
                  </div>
                  {/* Baixo-direita */}
                  <div className="absolute bottom-0 right-0">
                    <div className="absolute bottom-0 right-0 w-8 h-[3px] rounded-full"
                      style={{ background: 'linear-gradient(270deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute bottom-0 right-0 h-8 w-[3px] rounded-full"
                      style={{ background: 'linear-gradient(0deg,#facc15,transparent)', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }} />
                    <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-yellow-400"
                      style={{ boxShadow: '0 0 10px rgba(250,204,21,0.9), 0 0 20px rgba(250,204,21,0.4)' }} />
                  </div>
                </div>

                {/* Linha de scan */}
                {(autoMode || analyzing) && (
                  <motion.div
                    animate={{ top: ['12%', '86%', '12%'] }}
                    transition={{ repeat: Infinity, duration: 2.6, ease: 'linear' }}
                    className="absolute left-10 right-10 h-[1.5px]"
                    style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(250,204,21,0.5) 20%,rgba(250,204,21,1) 50%,rgba(250,204,21,0.5) 80%,transparent 100%)', boxShadow: '0 0 12px rgba(250,204,21,0.8), 0 0 30px rgba(250,204,21,0.3)' }}
                  />
                )}
              </div>
            )}

            {/* Flash */}
            <AnimatePresence>
              {flash && (
                <motion.div initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.18 }}
                  className="absolute inset-0 bg-white pointer-events-none" />
              )}
            </AnimatePresence>

            {/* Badge AUTO */}
            {autoMode && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-[11px] font-bold"
                style={{ background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
                <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                  className="w-1.5 h-1.5 rounded-full bg-white" />
                AO VIVO
              </div>
            )}

            {/* Analisando */}
            {analyzing && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-400/20"
                style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
                <Loader2 size={11} className="animate-spin text-yellow-400" />
                <span className="text-[11px] text-yellow-400 font-medium tracking-wide">Analisando carta...</span>
              </div>
            )}
          </div>
        </div>

        {/* Divisor */}
        <div className="w-px flex-shrink-0 my-4" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)' }} />

        {/* ── Resultado (direita) ── */}
        <div className="w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col p-4 gap-3 min-h-0">

          {/* Header painel */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold">Carta Identificada</span>
            </div>
            {card && (
              <button onClick={clearCard}
                className="text-[10px] text-white/18 hover:text-white/45 transition-colors flex items-center gap-1">
                Limpar <span className="text-white/25">✕</span>
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!card ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl"
                style={{ border: '1px dashed rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                {/* Só opacity pulse — sem y para não causar layout recalc */}
                <motion.div
                  animate={{ opacity: [0.15, 0.4, 0.15] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}>
                  <div className="text-6xl select-none">🃏</div>
                </motion.div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm text-white/22 font-medium">Nenhuma carta detectada</p>
                  <p className="text-[11px] text-white/14 leading-relaxed max-w-[180px]">
                    Aponte a câmera para uma carta e pressione <span className="text-white/28">Auto-Scan</span>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, type: 'spring', bounce: 0.2 }}
                className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {/* ── Card info ── */}
                <div className="flex-shrink-0 rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

                  {/* Acento do tipo */}
                  <div className="h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent 0%, ${typeClr}cc 40%, ${typeClr} 50%, ${typeClr}cc 60%, transparent 100%)` }} />

                  <div className="flex gap-3 p-4">
                    {/* Imagem */}
                    <motion.div
                      initial={{ rotateY: -80, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ duration: 0.65, delay: 0.08, type: 'spring' }}
                      style={{ perspective: 1000, flexShrink: 0 }}
                    >
                      {card.images?.large ? (
                        <Image src={card.images.large} alt={card.name} width={108} height={150}
                          className="rounded-xl"
                          style={{ maxHeight: '150px', width: 'auto', filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.8))' }}
                          unoptimized priority />
                      ) : (
                        <div className="w-[108px] h-[150px] rounded-xl bg-white/4 flex items-center justify-center border border-white/6">
                          <span className="text-white/15">🃏</span>
                        </div>
                      )}
                    </motion.div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2 py-0.5">
                      <div>
                        <h2 className="text-[1.2rem] font-black text-white leading-tight tracking-tight">{card.name}</h2>
                        <p className="text-[11px] text-white/30 mt-0.5 font-medium">{card.set.name} · <span className="text-white/20">#{card.number}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {card.types?.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: `${TYPE_COLORS[t]||'#facc15'}18`, color: TYPE_COLORS[t]||'#facc15', border: `1px solid ${TYPE_COLORS[t]||'#facc15'}35` }}>
                            {t}
                          </span>
                        ))}
                        {card.hp && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                            {card.hp} HP
                          </span>
                        )}
                        {card.rarity && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full truncate max-w-[140px]"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.22)' }}>
                            {card.rarity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Preços ── */}
                  <div className="px-4 pb-4 space-y-2 border-t border-white/[0.05] pt-3">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/18 mb-2">Valor de mercado</p>

                    {(card.ligaNormal || card.ligaFoil) ? (
                      <div className="space-y-2">
                        {card.ligaNormal && (
                          <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.14)' }}>
                            <p className="text-[8px] text-green-400/50 uppercase tracking-widest mb-2">🇧🇷 Liga · Normal</p>
                            <div className="grid grid-cols-3 text-center gap-1">
                              <div>
                                <p className="text-[8px] text-green-400/40 uppercase mb-0.5">Mín</p>
                                <p className="text-[13px] font-bold text-green-300/85">R${card.ligaNormal.min.toFixed(2).replace('.', ',')}</p>
                              </div>
                              <div className="border-x border-green-500/12">
                                <p className="text-[8px] text-green-400/55 uppercase mb-0.5">Méd</p>
                                <p className="text-[17px] font-black text-green-400 leading-tight">R${card.ligaNormal.avg.toFixed(2).replace('.', ',')}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-green-400/40 uppercase mb-0.5">Máx</p>
                                <p className="text-[13px] font-bold text-green-300/85">R${card.ligaNormal.max.toFixed(2).replace('.', ',')}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {card.ligaFoil && (
                          <div className="rounded-xl p-3" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.14)' }}>
                            <p className="text-[8px] text-purple-400/50 uppercase tracking-widest mb-2">✨ Liga · Foil</p>
                            <div className="grid grid-cols-3 text-center gap-1">
                              <div>
                                <p className="text-[8px] text-purple-400/40 uppercase mb-0.5">Mín</p>
                                <p className="text-[13px] font-bold text-purple-300/85">R${card.ligaFoil.min.toFixed(2).replace('.', ',')}</p>
                              </div>
                              <div className="border-x border-purple-500/12">
                                <p className="text-[8px] text-purple-400/55 uppercase mb-0.5">Méd</p>
                                <p className="text-[17px] font-black text-purple-400 leading-tight">R${card.ligaFoil.avg.toFixed(2).replace('.', ',')}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-purple-400/40 uppercase mb-0.5">Máx</p>
                                <p className="text-[13px] font-bold text-purple-300/85">R${card.ligaFoil.max.toFixed(2).replace('.', ',')}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {card.prices.usdNormal != null && (
                          <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
                            <p className="text-[8px] text-cyan-400/40 uppercase tracking-widest mb-0.5">Normal (est.)</p>
                            <p className="text-sm font-black text-cyan-400/85">R${(card.prices.usdNormal * brlRate).toFixed(2).replace('.', ',')}</p>
                            <p className="text-[8px] text-white/18">${card.prices.usdNormal.toFixed(2)}</p>
                          </div>
                        )}
                        {card.prices.usdFoil != null && (
                          <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.12)' }}>
                            <p className="text-[8px] text-purple-400/40 uppercase tracking-widest mb-0.5">Foil (est.)</p>
                            <p className="text-sm font-black text-purple-400/85">R${(card.prices.usdFoil * brlRate).toFixed(2).replace('.', ',')}</p>
                            <p className="text-[8px] text-white/18">${card.prices.usdFoil.toFixed(2)}</p>
                          </div>
                        )}
                        {card.prices.usdNormal == null && card.prices.usdFoil == null && card.prices.usd != null && (
                          <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
                            <p className="text-[8px] text-cyan-400/40 uppercase tracking-widest mb-0.5">Mercado (est.)</p>
                            <p className="text-sm font-black text-cyan-400/85">R${(card.prices.usd * brlRate).toFixed(2).replace('.', ',')}</p>
                            <p className="text-[8px] text-white/18">${card.prices.usd.toFixed(2)}</p>
                          </div>
                        )}
                        {card.prices.cardmarket != null && (
                          <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
                            <p className="text-[8px] text-blue-400/40 uppercase tracking-widest mb-0.5">Cardmarket</p>
                            <p className="text-sm font-black text-blue-400/85">R${(card.prices.cardmarket * brlRate * 1.1).toFixed(2).replace('.', ',')}</p>
                            <p className="text-[8px] text-white/18">€{card.prices.cardmarket.toFixed(2)}</p>
                          </div>
                        )}
                        {card.prices.usdNormal == null && card.prices.usdFoil == null && card.prices.usd == null && card.prices.cardmarket == null && (
                          <p className="col-span-2 text-[10px] text-white/15 text-center py-3">Preço não disponível</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Sugestões ── */}
                <AnimatePresence>
                  {suggestions.length > 0 && (
                    <motion.div key="suggestions"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex-shrink-0 rounded-2xl p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-2.5 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-white/20 inline-block" />
                        Pode ser também
                      </p>

                      <div className="grid grid-cols-5 gap-1.5">
                        {suggestions.slice(0, shownSuggCount).map((sug, i) => (
                          <motion.button
                            key={sug.id}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: (i % 5) * 0.05 }}
                            onClick={() => selectSuggestion(sug)}
                            title={`${sug.name} · ${sug.set.name}`}
                            className="group relative rounded-xl overflow-hidden aspect-[66/92] border border-white/6 hover:border-yellow-400/40 transition-all hover:scale-[1.03]"
                          >
                            {sug.images?.small ? (
                              <Image src={sug.images.small} alt={sug.name} fill
                                className="object-cover transition-transform duration-200 group-hover:scale-105"
                                unoptimized />
                            ) : (
                              <div className="w-full h-full bg-white/4 flex items-center justify-center">
                                <span className="text-white/15 text-xs">🃏</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1 px-0.5">
                              <span className="text-[6.5px] text-white/90 font-bold text-center leading-tight line-clamp-2">{sug.name}</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      {shownSuggCount < suggestions.length && (
                        <motion.button
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => setShownSuggCount(c => c + 5)}
                          className="mt-2 w-full py-2 rounded-xl border border-dashed border-white/8 hover:border-yellow-400/35 hover:bg-yellow-400/[0.04] transition-all flex items-center justify-center gap-2 text-white/25 hover:text-yellow-400/80 text-[11px] font-medium"
                        >
                          <span className="font-bold">+{Math.min(5, suggestions.length - shownSuggCount)}</span>
                          <span className="text-white/18 hover:text-yellow-400/50">sugestões</span>
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-20 flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.06]"
        style={{ background: 'rgba(6,6,16,0.9)', backdropFilter: 'blur(20px)' }}>

        {/* Status */}
        <AnimatePresence mode="wait">
          <motion.div key={statusKind + statusMsg.slice(0, 20)}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 text-[11px] font-medium flex-1 min-w-0 ${
              statusKind === 'found'    ? 'text-green-400' :
              statusKind === 'scanning' ? 'text-yellow-400' :
              statusKind === 'error'    ? 'text-red-400/90' : 'text-white/22'
            }`}
          >
            {statusKind === 'scanning' && <Loader2 size={11} className="animate-spin flex-shrink-0" />}
            {statusKind === 'found'    && <CheckCircle2 size={11} className="flex-shrink-0" />}
            {statusKind === 'error'    && <AlertTriangle size={11} className="flex-shrink-0" />}
            {statusKind === 'idle'     && <div className="w-1.5 h-1.5 rounded-full bg-white/15 flex-shrink-0" />}
            <span className="truncate">{statusMsg}</span>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!cameraActive ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
              onClick={startCamera}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#facc15,#f59e0b)', boxShadow: '0 0 20px rgba(250,204,21,0.35)' }}>
              <Camera size={14} /> Ligar Câmera
            </motion.button>
          ) : (
            <>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={autoMode ? stopAuto : startAuto}
                disabled={analyzing}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                  autoMode ? 'text-white' : 'text-black'
                }`}
                style={{
                  background: autoMode ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#facc15,#f59e0b)',
                  boxShadow: autoMode ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px rgba(250,204,21,0.35)',
                }}>
                {autoMode ? <><Square size={13} /> Parar</> : <><Play size={13} /> Auto-Scan</>}
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={() => captureAndAnalyze(true)}
                disabled={analyzing || autoMode}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-[12px] font-semibold hover:bg-white/8 disabled:opacity-30 transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)' }}>
                <Zap size={13} /> Manual
              </motion.button>

              <motion.button whileTap={{ scale: 0.88 }}
                onClick={() => setRotation(r => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
                title={`Rotação: ${rotation}°`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-medium transition-all hover:border-yellow-400/25 hover:text-yellow-400/70"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)' }}>
                <motion.div key={rotation} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.22 }}>
                  <RotateCw size={13} />
                </motion.div>
                <span>{rotation}°</span>
              </motion.button>

              <button onClick={stopCamera}
                className="p-2 rounded-xl border transition-all hover:border-white/18 hover:bg-white/6"
                style={{ border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.02)' }}>
                <RefreshCw size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
