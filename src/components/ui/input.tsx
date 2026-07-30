import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-borda bg-superficie px-3 py-1',
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
  )
}
