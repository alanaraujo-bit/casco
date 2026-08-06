import type { Falha } from '@/lib/erros'
import { z } from 'zod'
import { soDigitos, telefoneValido } from '@/lib/formatos'

export const esquemaEntregador = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome do entregador')
    .max(120, 'Máximo de 120 caracteres'),

  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, 'Telefone deve ter DDD e 8 ou 9 dígitos')
    .transform((v) => soDigitos(v) || null)
    .nullable(),
})

export type EntradaEntregador = z.input<typeof esquemaEntregador>
export type EntregadorValidado = z.output<typeof esquemaEntregador>

export const CAMPOS_ENTREGADOR = ['nome', 'telefone'] as const

export type CampoEntregador = (typeof CAMPOS_ENTREGADOR)[number]

export interface EstadoFormularioEntregador {
  erro?: Falha | string
  campos?: Partial<Record<CampoEntregador, string>>
  valores?: Partial<Record<CampoEntregador, string>>
  tentativa?: number
}
