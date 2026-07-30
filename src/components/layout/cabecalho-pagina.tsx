import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cabeçalho de tela: título, uma linha de contexto e as ações da direita.
 *
 * Existe como componente para que toda tela comece igual. No sistema antigo
 * cada tela resolveu o próprio cabeçalho, e o resultado é que o título muda de
 * tamanho e de posição conforme se navega — o usuário perde o ponto de
 * referência a cada clique.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string
  descricao?: React.ReactNode
  acoes?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && (
          <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  )
}
