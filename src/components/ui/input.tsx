import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<React.ComponentProps<'input'>, 'aria-invalid'> {
  /**
   * Mensagem de erro. Passar por aqui, em vez de renderizar um <p> solto ao
   * lado, é o que garante o vínculo `aria-describedby` — sem ele o leitor de
   * tela anuncia "inválido" e nunca diz por quê. Como o padrão fica dentro do
   * componente, ele não pode ser esquecido em cada formulário do sistema.
   */
  erro?: string
}

export function Input({ className, type, erro, id, ...props }: InputProps) {
  const gerado = React.useId()
  const idCampo = id ?? gerado
  const idErro = erro ? `${idCampo}-erro` : undefined

  return (
    <>
      <input
        id={idCampo}
        type={type}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idErro}
        className={cn(
          // 44px no toque, denso no desktop — mesmo raciocínio da fonte abaixo.
          'flex h-11 w-full rounded-md px-3 py-1 md:h-9',
          // A borda é a única coisa que diz onde o campo começa: token próprio,
          // com 3:1, como exige a WCAG 1.4.11. A borda decorativa de card
          // continua delicada.
          'border border-borda-controle bg-superficie',
          'text-texto placeholder:text-texto-fraco',
          'shadow-sm transition-[border-color,box-shadow] duration-150',
          'hover:border-borda-forte',
          'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foco focus-visible:border-acento',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-superficie-afundada',
          'aria-invalid:border-perigo aria-invalid:outline-perigo',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          // 16px no celular é obrigatório: abaixo disso o iOS dá zoom ao focar
          // o campo e a tela "salta". No desktop volta para 13px, que é a
          // densidade certa para uso prolongado.
          'text-base md:text-sm',
          className,
        )}
        {...props}
      />
      {erro && (
        <p id={idErro} className="text-xs text-perigo">
          {erro}
        </p>
      )}
    </>
  )
}
