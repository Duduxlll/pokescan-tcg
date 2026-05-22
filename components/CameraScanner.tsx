'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, RefreshCw, Zap, AlertCircle } from 'lucide-react'

interface CameraScannerProps {
  onCapture: (imageBase64: string) => void
  analyzing: boolean
  disabled?: boolean
}

export default function CameraScanner({ onCapture, analyzing, disabled }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || analyzing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    setFlash(true)
    setTimeout(() => setFlash(false), 300)

    const base64 = canvas.toDataURL('image/jpeg', 0.92)
    onCapture(base64)
  }, [analyzing, onCapture])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Área da câmera */}
      <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video">
        {/* Video feed */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Placeholder quando câmera está desligada */}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#0a0a1a] to-[#0d0d2a]">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center"
            >
              <Camera size={28} className="text-white/30" />
            </motion.div>
            <p className="text-sm text-white/30">Câmera desligada</p>
          </div>
        )}

        {/* Overlay de scan quando câmera ativa */}
        {active && !analyzing && (
          <>
            {/* Cantos do scanner */}
            <div className="absolute inset-6 pointer-events-none">
              {/* Canto superior esquerdo */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-yellow-400 rounded-tl-md" />
              {/* Canto superior direito */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-yellow-400 rounded-tr-md" />
              {/* Canto inferior esquerdo */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-yellow-400 rounded-bl-md" />
              {/* Canto inferior direito */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-yellow-400 rounded-br-md" />
            </div>

            {/* Linha de scan animada */}
            <motion.div
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              className="absolute left-6 right-6 top-6 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80 pointer-events-none"
              style={{ boxShadow: '0 0 12px rgba(250,204,21,0.8)' }}
            />
          </>
        )}

        {/* Flash de captura */}
        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Overlay de análise */}
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Zap size={36} className="text-yellow-400" style={{ filter: 'drop-shadow(0 0 12px #facc15)' }} />
              </motion.div>
              <div className="text-center">
                <p className="text-white font-semibold text-sm">Analisando carta...</p>
                <p className="text-white/50 text-xs mt-1">Lendo nome e número</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-yellow-400"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Erro */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botões */}
      <div className="mt-4 flex gap-3">
        {!active ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={startCamera}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-yellow-400 text-black font-bold text-sm transition-all hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 24px rgba(250,204,21,0.4)' }}
          >
            <Camera size={18} />
            Ligar Câmera
          </motion.button>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={capture}
              disabled={analyzing}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-yellow-400 text-black font-bold text-sm transition-all hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 24px rgba(250,204,21,0.4)' }}
            >
              <Zap size={18} />
              {analyzing ? 'Analisando...' : 'Escanear Carta'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={stopCamera}
              disabled={analyzing}
              className="py-3.5 px-4 rounded-xl border border-white/10 bg-white/5 text-white/60 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={16} />
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  )
}
