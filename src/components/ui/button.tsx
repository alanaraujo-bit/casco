import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md font-medium select-none',
    'transition-[background-color,border-color,color,box-shadow] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    // O balconista opera no teclado: foco nunca some.
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primario:
          'bg-acento text-acento-contraste shadow-sm hover:bg-acento-hover active:bg-acento-ativo',
        secundario:
          'bg-superficie text-texto border border-borda shadow-sm hover:bg-superficie-hover hover:border-borda-forte',
        suave:
          'bg-acento-suave text-acento-texto border border-acento-suave-borda hover:bg-acento-suave/70',
        fantasma: 'text-texto-suave hover:bg-superficie-hover hover:text-texto',
        perigo: 'bg-perigo text-white shadow-sm hover:brightness-110 active:brightness-95',
        link: 'text-acento-texto underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
        // Alvo de toque de 44px: mínimo confortável no celular do entregador.
        toque: 'h-11 px-4 text-base',
        icone: 'size-8 p-0',
        'icone-toque': 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'secundario', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      // Botão dentro de <form> sem type explícito submete por acidente.
      // Erra fechado: só submete quem pediu.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { buttonVariants }
