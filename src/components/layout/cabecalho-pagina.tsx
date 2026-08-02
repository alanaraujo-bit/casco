import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cabeçalho de tela: título, uma linha de contexto e as ações da direita.
 *
 * Existe como componente para que toda tela comece igual. Quando cada tela
 * resolve o próprio cabeçalho, o título muda de tamanho e de posição conforme
 * se navega — e o usuário perde o ponto de referência a cada clique.
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
        {/* Só a partir de `md`. No celular quem carrega o título é a barra
            superior fixa, que fica a 40px daqui — os dois juntos repetiam a
            mesma palavra na mesma dobra e colocavam dois `h1` na árvore de
            acessibilidade. `display:none` tira do leitor de tela também, então
            em cada largura existe exatamente um. */}
        <h1 className="hidden text-xl font-semibold tracking-tight text-texto md:block">
          {titulo}
        </h1>
        {descricao && <p className="text-sm text-texto-suave md:mt-0.5">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  )
}
