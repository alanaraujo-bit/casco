import type { Falha } from '@/lib/erros'
import { z } from 'zod'
import { PRIORIDADES_FEEDBACK, TIPOS_FEEDBACK } from '@/db/schema'

/**
 * O que vale como feedback.
 *
 * **Sugestão não tem prioridade.** Bug e melhoria competem por atenção — a
 * pessoa que relata é quem sabe se travou o balcão ou se é só um incômodo.
 * Sugestão de funcionalidade nova não tem "urgência" nesse sentido, e forçar
 * a escolha faria a pessoa chutar "alta" só para ser ouvida.
 */

export const esquemaFeedback = z
  .object({
    tipo: z.enum(TIPOS_FEEDBACK, { message: 'Escolha o tipo de feedback' }),
    prioridade: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (PRIORIDADES_FEEDBACK as readonly string[]).includes(v),
        'Prioridade inválida',
      )
      .transform((v) => (v || null) as (typeof PRIORIDADES_FEEDBACK)[number] | null)
      .nullable(),
    titulo: z
      .string()
      .trim()
      .min(4, 'Escreva um título curto para o relato')
      .max(120, 'Máximo de 120 caracteres'),
    descricao: z
      .string()
      .trim()
      .min(10, 'Descreva com um pouco mais de detalhe')
      .max(2000, 'Máximo de 2000 caracteres'),
    /** Capturada pela tela a partir da rota atual, não digitada. */
    rota: z
      .string()
      .trim()
      .max(200)
      .transform((v) => v || null)
      .nullable(),
    /** Presente quando o relato nasce a partir de uma tela de erro. */
    codigoErro: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v || null)
      .nullable(),
  })
  .refine((d) => d.tipo === 'sugestao' || d.prioridade !== null, {
    path: ['prioridade'],
    message: 'Escolha a prioridade',
  })
  .refine((d) => d.tipo !== 'sugestao' || d.prioridade === null, {
    path: ['prioridade'],
    message: 'Sugestão não tem prioridade',
  })

export type FeedbackValidado = z.output<typeof esquemaFeedback>

export const CAMPOS_FEEDBACK = [
  'tipo',
  'prioridade',
  'titulo',
  'descricao',
  'rota',
  'codigoErro',
] as const

export type CampoFeedback = (typeof CAMPOS_FEEDBACK)[number]

export interface EstadoFormularioFeedback {
  erro?: Falha | string
  campos?: Partial<Record<CampoFeedback, string>>
  valores?: Partial<Record<CampoFeedback, string>>
  tentativa?: number
  sucesso?: boolean
}

export const ROTULO_TIPO_FEEDBACK: Record<(typeof TIPOS_FEEDBACK)[number], string> = {
  bug: 'Bug',
  melhoria: 'Melhoria',
  sugestao: 'Sugestão',
}

export const ROTULO_PRIORIDADE_FEEDBACK: Record<
  (typeof PRIORIDADES_FEEDBACK)[number],
  string
> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}
