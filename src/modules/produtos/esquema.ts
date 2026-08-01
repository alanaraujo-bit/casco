import { z } from 'zod'

/**
 * O que vale como produto.
 *
 * Mesma filosofia do esquema de clientes: vive em arquivo próprio para que
 * formulário e action compartilhem a mesma regra.
 *
 * **Nome e unidade são obrigatórios.** O resto pode ser completado depois.
 * Preço zero é válido: produto novo pode ser cadastrado antes de definir
 * preço, e a tabela de preço por tipo de cliente é que define o valor real.
 */

const textoOpcional = (max = 120) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => v || null)
    .nullable()

const monetario = z
  .string()
  .trim()
  .transform((v) => (v === '' ? 0 : Number(v.replace(/\./g, '').replace(',', '.'))))
  .refine((v) => Number.isFinite(v) && v >= 0, 'Valor inválido')

const numerico = z
  .string()
  .trim()
  .transform((v) => (v === '' ? 0 : Number(v.replace(/\./g, '').replace(',', '.'))))
  .refine((v) => Number.isFinite(v) && v >= 0, 'Quantidade inválida')

export const UNIDADES = ['un', 'cx', 'kg', 'l', 'pc', 'fd', 'gl'] as const
export type Unidade = (typeof UNIDADES)[number]

export const ROTULO_UNIDADE: Record<Unidade, string> = {
  un: 'Unidade',
  cx: 'Caixa',
  kg: 'Quilograma',
  l: 'Litro',
  pc: 'Pacote',
  fd: 'Fardo',
  gl: 'Galão',
}

export const esquemaProduto = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome do produto')
    .max(120, 'Máximo de 120 caracteres'),

  sku: textoOpcional(60),

  categoria: textoOpcional(60),

  unidade: z.enum(UNIDADES, { message: 'Escolha a unidade' }),

  precoPadrao: monetario,

  custo: monetario,

  retornavel: z
    .string()
    .transform((v) => v === 'true')
    .or(z.boolean()),

  vasilhameId: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Vasilhame inválido')
    .transform((v) => v || null)
    .nullable(),

  controlaEstoque: z
    .string()
    .transform((v) => v === 'true')
    .or(z.boolean()),

  estoqueMinimo: numerico,

  estoqueMaximo: numerico,

  ncm: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{8}$/.test(v.replace(/\./g, '')), 'NCM deve ter 8 dígitos')
    .transform((v) => v.replace(/\./g, '') || null)
    .nullable(),
})

export type EntradaProduto = z.input<typeof esquemaProduto>
export type ProdutoValidado = z.output<typeof esquemaProduto>

export const CAMPOS_PRODUTO = [
  'nome',
  'sku',
  'categoria',
  'unidade',
  'precoPadrao',
  'custo',
  'retornavel',
  'vasilhameId',
  'controlaEstoque',
  'estoqueMinimo',
  'estoqueMaximo',
  'ncm',
] as const

export type CampoProduto = (typeof CAMPOS_PRODUTO)[number]

export interface EstadoFormularioProduto {
  erro?: string
  campos?: Partial<Record<CampoProduto, string>>
  valores?: Partial<Record<CampoProduto, string>>
  tentativa?: number
}
