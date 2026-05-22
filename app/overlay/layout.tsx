export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { background: transparent !important; overflow: hidden; }
        `}</style>
      </head>
      <body style={{ background: 'transparent' }}>{children}</body>
    </html>
  )
}
