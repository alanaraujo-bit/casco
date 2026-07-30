'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Hammer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Botão que abre o que a tela vai fazer, em vez de não fazer nada.
 *
 * Durante a demonstração todo botão primário apontava para tela não construída
 * ou não tinha ação nenhuma. Botão morto custa mais caro do que botão ausente:
 * o cliente clica, não acontece nada, e a partir dali ele desconfia de tudo
 * que viu. Aqui o clique entrega uma resposta honesta e útil — o que a tela
 * vai fazer, item por item — e o roteiro da conversa continua.
 *
 * Some quando a tela real existir: é trocar por `asChild` + `Link`.
 */
export function BotaoEmBreve({
  children,
  titulo,
  descricao,
  itens,
  variant = 'primario',
  size = 'sm',
  className,
}: {
  children: React.ReactNode
  titulo: string
  descricao: string
  /** O que a tela vai fazer. Concreto, na linguagem do cliente. */
  itens: string[]
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant={variant} size={size} className={className}>
          {children}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-sobreposicao" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-borda bg-superficie-elevada p-5 shadow-lg',
            'focus:outline-none',
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-acento-suave text-acento-texto"
              aria-hidden
            >
              <Hammer className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-texto">
                {titulo}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-texto-suave">
                {descricao}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-md text-texto-fraco hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Fechar</span>
              </button>
            </Dialog.Close>
          </div>

          <ul className="mt-4 space-y-2">
            {itens.map((i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-texto-suave">
                <Check className="mt-0.5 size-4 shrink-0 text-sucesso" aria-hidden />
                <span>{i}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="secundario">Entendi</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
