import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Junta classes resolvendo conflitos do Tailwind — a última vence.
 * Sem isso, `cn('p-2', 'p-4')` deixaria as duas no HTML e o resultado
 * dependeria da ordem no CSS gerado, não da ordem no código.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata em Real. Usa sempre pt-BR para não variar com o locale do device. */
export function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

/** Formata quantidade sem casas decimais desnecessárias (galões são inteiros). */
export function quantidade(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(valor)
}
