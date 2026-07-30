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
          'bg-superficie text-texto border border-borda-controle shadow-sm hover:bg-superficie-hover hover:border-borda-forte',
        suave:
          'bg-acento-suave text-acento-texto border border-acento-suave-borda hover:bg-acento-suave/70',
        fantasma: 'text-texto-suave hover:bg-superficie-hover hover:text-texto',
        // Tokens em vez de `text-white` + filtro de brilho: branco sobre o
        // vermelho do tema escuro dá 2.74:1, e o botão que exclui lançamento
        // ficaria ilegível. `brightness()` também inverteria a semântica de
        // "pressionado" em um dos dois temas.
        perigo:
          'bg-perigo text-perigo-contraste shadow-sm hover:bg-perigo-hover active:bg-perigo-ativo',
        link: 'text-acento-texto underline-offset-4 hover:underline',
      },
      size: {
        // Alvo de 44px por padrão no toque, compacto a partir de `md`.
        // Depender de o desenvolvedor lembrar de `size="toque"` seria frágil
        // por construção — o entregador usa Android barato, na rua, de moto.
        // Também 44px no toque: `sm` vai para barra de filtro e ação de linha
        // de tabela, que são telas que o entregador usa.
        sm: 'h-11 px-3 text-sm md:h-7 md:px-2.5 md:text-xs',
        md: 'h-11 px-4 text-base md:h-8 md:px-3 md:text-sm',
        lg: 'h-12 px-5 text-base md:h-10 md:px-4',
        icone: 'size-11 p-0 md:size-8',
        /** Força 44px em qualquer breakpoint — telas do entregador. */
        toque: 'h-11 px-4 text-base',
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
