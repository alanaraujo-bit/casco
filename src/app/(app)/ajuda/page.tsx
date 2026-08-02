import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { BuscaAjuda } from '@/components/ajuda/busca'
import { Card } from '@/components/ui/card'
import { artigosDoGrupo, GRUPOS_AJUDA } from '@/lib/ajuda'

export const metadata: Metadata = { title: 'Central de Ajuda' }

export default function PaginaAjuda() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Central de Ajuda"
        descricao="Como usar o Casco, direto do jeito que ele funciona de verdade — com vídeo de cada tela"
      />

      <BuscaAjuda />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GRUPOS_AJUDA.map((g) => {
          const artigos = artigosDoGrupo(g.slug)
          return (
            <Card key={g.slug} className="flex flex-col p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-acento-suave text-acento-texto">
                  <g.Icone className="size-4" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-texto">{g.rotulo}</h2>
              </div>

              {artigos.length === 0 ? (
                <p className="text-xs text-texto-fraco">
                  Em construção — chega numa próxima etapa da Central de Ajuda.
                </p>
              ) : (
                <ul className="-mx-1.5 space-y-0.5">
                  {artigos.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/ajuda/${a.grupoSlug}/${a.slug}`}
                        className="flex items-center gap-1.5 rounded-md px-1.5 py-2 text-sm text-texto hover:bg-superficie-hover hover:text-acento-texto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco"
                      >
                        <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
                        <ChevronRight className="size-3.5 shrink-0 text-texto-fraco" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
