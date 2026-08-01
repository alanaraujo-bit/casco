import { z } from 'zod'

export const esquemaTabela = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome da tabela')
    .max(60, 'Máximo de 60 caracteres'),

  padrao: z
    .string()
    .transform((v) => v === 'true')
    .or(z.boolean()),
})

export type EntradaTabela = z.input<typeof esquemaTabela>
export type TabelaValidada = z.output<typeof esquemaTabela>

export const CAMPOS_TABELA = ['nome', 'padrao'] as const
export type CampoTabela = (typeof CAMPOS_TABELA)[number]

export interface EstadoFormularioTabela {
  erro?: string
  campos?: Partial<Record<CampoTabela, string>>
  valores?: Partial<Record<CampoTabela, string>>
  tentativa?: number
}
