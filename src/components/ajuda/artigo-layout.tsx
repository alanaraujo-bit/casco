import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Moldura comum a todo artigo: migalha de pão até a Central, título, resumo
 * de uma linha, e o corpo. Existe para que artigo novo nasça no mesmo padrão
 * sem que quem escreve precise lembrar de repetir título e navegação — mesmo
 * raciocínio do `CabecalhoPagina` para o resto do app.
 */
export function ArtigoLayout({
  grupo,
  titulo,
  resumo,
  children,
}: {
  grupo: string
  titulo: string
  resumo: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-[64ch] space-y-6 pb-10">
      <nav aria-label="Migalha de pão" className="flex items-center gap-1 text-xs text-texto-fraco">
        <Link href="/ajuda" className="hover:text-texto hover:underline">
          Central de Ajuda
        </Link>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{grupo}</span>
      </nav>

      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-texto md:text-2xl">{titulo}</h1>
        <p className="text-sm text-texto-suave">{resumo}</p>
      </header>

      <div className={cn('space-y-6 text-sm leading-relaxed text-texto', '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-texto [&_h2]:tracking-tight [&_h2]:pt-2')}>
        {children}
      </div>
    </article>
  )
}

/** Título de seção dentro do artigo — só para ganhar o espaçamento certo do `[&_h2]`. */
export function SecaoArtigo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2>{titulo}</h2>
      {children}
    </section>
  )
}
