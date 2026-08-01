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
        {/*
          Pede ao Dark Reader que não toque nesta página.

          A extensão reescreve o DOM antes do React hidratar — enfia
          `data-darkreader-inline-stroke` e um `style` com `--darkreader-*` em
          cada `<svg>` — e o React acusa a diferença entre o que o servidor
          mandou e o que encontrou. O erro de hidratação que aparece no `next
          dev` nasce daí, não do nosso código, e some junto com esta linha.

          Não é só calar aviso: o Casco já tem tema claro e escuro próprios,
          resolvidos pelo `scriptTema` logo abaixo. Escurecer por cima de um
          tema escuro é o que produz o texto sem contraste e o gráfico com cor
          trocada — a extensão não sabe que o trabalho dela já está feito.
          `darkreader-lock` é o jeito que a própria extensão oferece para um
          site dizer isso.
        */}
        <meta name="darkreader-lock" />

        {/* Antes de qualquer pintura, para não piscar o tema errado. */}
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
