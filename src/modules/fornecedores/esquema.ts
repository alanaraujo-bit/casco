import { z } from 'zod'
import { documentoValido, soDigitos, telefoneValido, UFS } from '@/lib/formatos'

const textoOpcional = (max = 120) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => v || null)
    .nullable()

export const esquemaFornecedor = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome do fornecedor')
    .max(120, 'Máximo de 120 caracteres'),

  documento: z
    .string()
    .trim()
    .refine(documentoValido, 'CPF ou CNPJ inválido — confira os números')
    .transform((v) => soDigitos(v) || null)
    .nullable(),

  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, 'Telefone deve ter DDD e 8 ou 9 dígitos')
    .transform((v) => soDigitos(v) || null)
    .nullable(),

  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido')
    .transform((v) => v || null)
    .nullable(),

  cidade: textoOpcional(60),

  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || (UFS as readonly string[]).includes(v), 'UF inválida')
    .transform((v) => v || null)
    .nullable(),

  observacoes: textoOpcional(500),
})

export type EntradaFornecedor = z.input<typeof esquemaFornecedor>
export type FornecedorValidado = z.output<typeof esquemaFornecedor>

export const CAMPOS_FORNECEDOR = [
  'nome',
  'documento',
  'telefone',
  'email',
  'cidade',
  'uf',
  'observacoes',
] as const

export type CampoFornecedor = (typeof CAMPOS_FORNECEDOR)[number]

export interface EstadoFormularioFornecedor {
  erro?: string
  campos?: Partial<Record<CampoFornecedor, string>>
  valores?: Partial<Record<CampoFornecedor, string>>
  tentativa?: number
}
