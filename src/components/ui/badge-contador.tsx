import { cn } from '@/lib/utils'

/**
 * Círculo numérico sobre um item de menu — "existe N coisa nova aqui".
 *
 * Variante própria em vez de `Badge`: `Badge` é retangular e pensado para
 * ficar ao lado de texto ("Vencido", "Pago"); este é um círculo pequeno feito
 * para pousar sobre um ícone ou no fim de um rótulo, sem competir com ele em
 * largura. `info`, não `perigo` — não lido é novidade, não é problema.
 */
export function BadgeContador({ valor, className }: { valor: number; className?: string }) {
  if (valor <= 0) return null

  return (
    <span
      className={cn(
        'inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1',
        'bg-info-bg text-2xs font-semibold tabular-nums text-info',
        className,
      )}
    >
      {valor > 99 ? '99+' : valor}
    </span>
  )
}
