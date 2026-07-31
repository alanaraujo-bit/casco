import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { classeCampo } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SelectProps extends Omit<React.ComponentProps<'select'>, 'aria-invalid'> {
  erro?: string
}

/**
 * `<select>` nativo, com a aparência do `Input`.
 *
 * Nativo de propósito, ao contrário do menu do Radix usado na topbar: no
 * celular o `<select>` abre a roda do sistema, que é grande, rolável com o
 * polegar e familiar. Um dropdown desenhado por nós seria uma lista de 12px
 * dentro da página — pior justamente onde a operadora mais precisa acertar de
 * primeira. Combo customizado só quando precisar de busca dentro da lista.
 */
export function Select({
  className,
  erro,
  id,
  children,
  'aria-describedby': descritoPor,
  ...props
}: SelectProps) {
  const gerado = React.useId()
  const idCampo = id ?? gerado
  const idErro = erro ? `${idCampo}-erro` : undefined
  const descricao = [descritoPor, idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1">
      <div className="relative">
        <select
          {...props}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          className={cn(
            classeCampo,
            // `appearance-none` tira a seta do sistema para desenharmos a
            // nossa; o padding à direita é o espaço dela. Sem o padding, o
            // texto de uma opção longa passa por baixo do ícone.
            'appearance-none pr-9',
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco"
          aria-hidden
        />
      </div>
      {erro && (
        <p id={idErro} className="text-xs text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
