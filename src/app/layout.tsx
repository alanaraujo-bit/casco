import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { scriptTema } from '@/components/theme-toggle'
import './globals.css'

/**
 * Inter pela legibilidade em corpo pequeno e, principalmente, pelos algarismos:
 * o sistema é cheio de coluna de dinheiro, e Inter tem tabular-nums de verdade.
 */
const inter = Inter({
  variable: '--fonte-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Casco',
    template: '%s · Casco',
  },
  description:
    'Gestão para distribuidoras com vasilhame retornável — água e gás.',
  applicationName: 'Casco',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Ocupa a área sob o notch; o conteúdo é protegido por safe-area no shell.
  viewportFit: 'cover',
  // Valor claro como ponto de partida — o `scriptTema` reescreve o `content`
  // conforme o tema RESOLVIDO. Amarrar isso a `prefers-color-scheme` estaria
  // errado em dois dos quatro cenários: quem força um tema contra o sistema
  // teria a barra do navegador de uma cor e a página de outra.
  themeColor: '#f3f4f6',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Antes de qualquer pintura, para não piscar o tema errado. */}
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
