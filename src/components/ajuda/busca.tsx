'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, Search, SearchX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ARTIGOS_BUSCA, GRUPOS_AJUDA, buscarArtigos } from '@/lib/ajuda'

/**
 * Busca da Central de Ajuda.
 *
 * Client component isolado — só ele precisa de estado. A página em volta
 * (grupos, "em breve") continua Server Component, renderizada de uma vez.
 */
export function BuscaAjuda() {
  const [consulta, setConsulta] = React.useState('')
  const resultados = React.useMemo(() => buscarArtigos(consulta, ARTIGOS_BUSCA), [consulta])
  const buscando = consulta.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-texto-fraco"
          aria-hidden
        />
        <Input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Digite o que você precisa fazer — ex.: “vasilhame quebrado”"
          aria-label="Buscar na Central de Ajuda"
          className="h-12 pl-11 text-base md:h-11 md:text-sm"
        />
      </div>

      {buscando && (
        <div className="rounded-lg border border-borda bg-superficie">
          {resultados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <SearchX className="size-6 text-texto-fraco" aria-hidden />
              <p className="text-sm text-texto-suave">
                Nada encontrado para <strong className="text-texto">“{consulta}”</strong>.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-borda">
              {resultados.map((a) => {
                const g = GRUPOS_AJUDA.find((g) => g.slug === a.grupoSlug)
                return (
                  <li key={a.slug}>
                    <Link
                      href={`/ajuda/${a.grupoSlug}/${a.slug}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-superficie-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco"
                    >
                      {g && <g.Icone className="size-4 shrink-0 text-texto-fraco" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto">{a.titulo}</p>
                        <p className="truncate text-xs text-texto-suave">{a.resumo}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-texto-fraco" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
