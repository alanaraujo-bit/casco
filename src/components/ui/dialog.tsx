'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export function DialogContent({
  className,
  children,
  titulo,
  descricao,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  titulo: string
  descricao?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-sobreposicao print:hidden" />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-lg border border-borda bg-superficie shadow-lg',
          'max-h-[85dvh] overflow-y-auto',
          'focus:outline-none',
          // Impresso é o conteúdo em si, nunca o diálogo por cima dele — quem
          // precisa de papel são os dados, não o cromo (borda, sombra, o X de
          // fechar). O bloco imprimível de verdade fica fora daqui, fora do
          // recorte de `overflow-y-auto`, que corta o que não está rolado à
          // vista antes de mandar imprimir.
          'print:hidden',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-borda px-4 py-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-texto">
              {titulo}
            </DialogPrimitive.Title>
            {/* Obrigatório pelo Radix: o diálogo precisa se anunciar ao
                receber foco. Some da tela quando não há texto próprio para
                mostrar, mas continua existindo para o leitor de tela. */}
            <DialogPrimitive.Description
              className={descricao ? 'mt-0.5 text-xs text-texto-suave' : 'sr-only'}
            >
              {descricao ?? titulo}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-md',
              'text-texto-suave hover:bg-superficie-hover hover:text-texto',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
            )}
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>

        <div className="p-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
