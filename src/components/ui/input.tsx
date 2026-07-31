import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A aparência de um campo, isolada para que `Input`, `Select` e `Textarea`
 * fiquem idênticos.
 *
 * Estava só dentro do `Input`. Ao nascer o segundo campo, copiar a string era
 * garantir que os dois divergiriam no primeiro ajuste de foco ou de borda — e
 * campo com altura ou anel de foco diferente do vizinho é o tipo de coisa que
 * ninguém sabe nomear, mas todo mundo percebe.
 */
export const classeCampo = cn(
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
  // `text-base` aqui vale 16px por definição da escala. Abaixo disso o
  // iOS dá zoom ao focar o campo e a tela "salta". No desktop cai para
  // 14px, que é a densidade certa para uso prolongado.
  'text-base md:text-sm',
)

export interface InputProps extends Omit<React.ComponentProps<'input'>, 'aria-invalid'> {
  /**
   * Mensagem de erro. Passar por aqui, em vez de renderizar um <p> solto ao
   * lado, é o que garante o vínculo `aria-describedby` — sem ele o leitor de
   * tela anuncia "inválido" e nunca diz por quê. Como o padrão fica dentro do
   * componente, ele não pode ser esquecido em cada formulário do sistema.
   */
  erro?: string
}

export function Input({
  className,
  type,
  erro,
  id,
  'aria-describedby': descritoPor,
  ...props
}: InputProps) {
  const gerado = React.useId()
  const idCampo = id ?? gerado
  const idErro = erro ? `${idCampo}-erro` : undefined

  // Mescla em vez de deixar sobrescrever: um campo com texto de ajuda E erro
  // perderia silenciosamente o vínculo do erro, anulando justamente o motivo
  // desta prop existir — e o TypeScript não avisaria.
  const descricao = [descritoPor, idErro].filter(Boolean).join(' ') || undefined

  return (
    // O erro sai embrulhado junto com o campo para que o layout não dependa de
    // o chamador lembrar de um `space-y`. Dentro de um flex, um Fragment
    // faria a mensagem virar irmã do input e escapar do agrupamento.
    <div className="space-y-1">
      <input
        {...props}
        id={idCampo}
        type={type}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={cn(
          classeCampo,
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
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
