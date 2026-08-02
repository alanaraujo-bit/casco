'use client'

import * as React from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * O GIF real capturado do sistema rodando (`scripts/capturar-ajuda.mjs`),
 * nunca uma sequência de screenshots estáticas — é o que faz o artigo mostrar
 * "como se faz" em vez de descrever.
 *
 * `<img>` puro e não `next/image`: o Next reprocessa GIF como imagem estática
 * de um frame só, perdendo a animação — o que o disable abaixo explica.
 *
 * Respeita `prefers-reduced-motion`: em vez de animar sozinho, mostra o
 * primeiro frame (`poster`) parado com um botão de play que troca para o GIF
 * animado só quando a pessoa pede. Sem isso, quem configurou o sistema para
 * reduzir movimento (enjoo, vestibular) não tem como evitar a animação — GIF
 * não obedece `prefers-reduced-motion` sozinho como `<video>` obedeceria.
 *
 * `useSyncExternalStore`, não `useState` + `useEffect`: a preferência do SO é
 * estado externo de verdade (muda fora do React), e este hook é o jeito
 * correto de assinar isso sem o efeito colateral de um `setState` síncrono no
 * corpo do efeito — que o React 19 já sinaliza como redundante. O snapshot do
 * servidor fica em "não reduz" para casar com o primeiro paint do cliente
 * antes da hidratação.
 */
function usePrefereReduzirMovimento(): boolean {
  return React.useSyncExternalStore(
    (notificar) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', notificar)
      return () => mq.removeEventListener('change', notificar)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

export function Video({
  src,
  poster,
  legenda,
  className,
}: {
  /** GIF em `public/ajuda/`, ex. `/ajuda/baixa-vasilhame.gif`. */
  src: string
  /** Primeiro frame, estático — gerado junto do GIF pelo script de captura. */
  poster: string
  legenda: string
  className?: string
}) {
  const [tocando, setTocando] = React.useState(false)
  const reduzMovimento = usePrefereReduzirMovimento()

  const mostrarAnimado = tocando || !reduzMovimento

  return (
    <figure className={cn('overflow-hidden rounded-lg border border-borda bg-superficie-afundada', className)}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- GIF precisa continuar animado; next/image achataria num frame só */}
        <img
          src={mostrarAnimado ? src : poster}
          alt={legenda}
          className="w-full"
          loading="lazy"
        />
        {!mostrarAnimado && (
          <button
            type="button"
            onClick={() => setTocando(true)}
            className={cn(
              'absolute inset-0 flex items-center justify-center gap-2 bg-sobreposicao text-white',
              'text-sm font-medium transition-opacity hover:opacity-90',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foco',
            )}
          >
            <span className="grid size-11 place-items-center rounded-full bg-white/90 text-texto shadow-lg">
              <Play className="ml-0.5 size-5" aria-hidden />
            </span>
            <span className="sr-only">Reproduzir demonstração</span>
          </button>
        )}
      </div>
      <figcaption className="border-t border-borda px-3 py-2 text-xs text-texto-suave">
        {legenda}
      </figcaption>
    </figure>
  )
}
