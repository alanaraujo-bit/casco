import { z } from 'zod'
import { paraNumero } from '@/modules/vendas/esquema'

/**
 * O que vale como baixa de um título.
 *
 * A decisão que organiza o arquivo: **a situação nunca é digitada.** Não existe
 * campo "Recebido?" nem "Status" — existe data de pagamento e valor pago, e a
 * situação sai deles. No sistema deles a situação é uma coluna gravada, e é por
 * isso que dá para ver linha marcada "Vencido" com vencimento no mês que vem:
 * alguém guardou como dado o que era consequência.
 *
 * A segunda: **baixa pela metade não existe.** Ou o título tem data **e** valor,
 * ou não tem baixa nenhuma — é o `contas_receber_baixa_completa` da migration
 * 0006, e a tela obedece antes de o banco precisar recusar. Um título com valor
 * pago e sem data trava a conciliação: o relatório sabe quanto entrou e não sabe
 * quando.
 */

export const CAMPOS_BAIXA = ['tituloId', 'pagoEm', 'valorPago', 'contaId', 'formaId'] as const
export type CampoBaixa = (typeof CAMPOS_BAIXA)[number]

const uuid = z
  .string()
  .trim()
  .refine((v) => z.string().uuid().safeParse(v).success, 'Seleção inválida')

export const esquemaBaixa = z.object({
  tituloId: uuid,

  /**
   * `YYYY-MM-DD`, como vem do `<input type="date">` e como o Postgres guarda.
   *
   * Sem conversão para `Date` no meio: um `new Date('2026-08-01')` vira
   * meia-noite UTC, que em Tucumã ainda é 31 de julho — e a baixa cairia no dia
   * anterior no fechamento de caixa.
   */
  pagoEm: z
    .string()
    .trim()
    .min(1, 'Informe a data do pagamento')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),

  valorPago: z
    .string()
    .transform(paraNumero)
    .refine((v) => Number.isFinite(v), 'Valor inválido')
    .refine((v) => v > 0, 'O valor recebido precisa ser maior que zero'),

  contaId: uuid,
  formaId: uuid,
})

export interface ReciboBaixa {
  codigo: number | null
  cliente: string
  valorPago: number
  taxa: number
  /** O que de fato entrou na conta, já sem a taxa da maquininha. */
  liquido: number
  conta: string
  forma: string
  /** Diferença entre o que foi cobrado e o que entrou. Positivo = faltou. */
  diferenca: number
}

export interface EstadoBaixa {
  erro?: string
  campos?: Partial<Record<CampoBaixa, string>>
  valores?: Partial<Record<CampoBaixa, string>>
  tentativa?: number
  recibo?: ReciboBaixa
}
