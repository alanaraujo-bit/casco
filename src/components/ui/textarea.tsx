import * as React from 'react'
import { classeCampo } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends Omit<React.ComponentProps<'textarea'>, 'aria-invalid'> {
  erro?: string
}

export function Textarea({
  className,
  erro,
  id,
  'aria-describedby': descritoPor,
  ...props
}: TextareaProps) {
  const gerado = React.useId()
  const idCampo = id ?? gerado
  const idErro = erro ? `${idCampo}-erro` : undefined
  const descricao = [descritoPor, idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1">
      <textarea
        {...props}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={cn(
          classeCampo,
          // A altura fixa do `classeCampo` não serve para texto de várias
          // linhas. `field-sizing-content` faz a caixa crescer com o que foi
          // digitado, e o `min-h` garante que ela já nasça visivelmente
          // diferente de um campo de uma linha.
          'h-auto min-h-20 py-2 [field-sizing:content]',
          className,
        )}
      />
      {erro && (
        <p id={idErro} className="text-xs text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
