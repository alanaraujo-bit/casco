import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Um passo numerado de um fluxo. A numeração é a única coisa que diz "isto é
 * sequência, não uma lista de opções" — sem ela, três parágrafos com título em
 * negrito parecem três dicas soltas, e a operadora não sabe se a ordem importa.
 */
export function Passos({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-5">{children}</ol>
}

export function Passo({
  numero,
  titulo,
  children,
  className,
}: {
  numero: number
  titulo: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <li className={cn('flex gap-3.5', className)}>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-acento-suave text-sm font-semibold text-acento-texto"
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <p className="font-medium text-texto">{titulo}</p>
        {children && <div className="space-y-2 text-sm text-texto-suave">{children}</div>}
      </div>
    </li>
  )
}
