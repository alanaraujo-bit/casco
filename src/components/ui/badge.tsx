import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Selo de estado. As variantes existem para significar, não para enfeitar:
 * verde é pago/entregue, âmbar é pendente, vermelho é vencido/quebrado.
 * Se um selo aparecer sem estado por trás, a variante está sendo usada errado.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutro: 'border-borda bg-superficie-afundada text-texto-suave',
        sucesso: 'border-transparent bg-sucesso-bg text-sucesso',
        alerta: 'border-transparent bg-alerta-bg text-alerta',
        perigo: 'border-transparent bg-perigo-bg text-perigo',
        info: 'border-transparent bg-info-bg text-info',
        acento: 'border-acento-suave-borda bg-acento-suave text-acento-texto',
      },
    },
    defaultVariants: { variant: 'neutro' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
