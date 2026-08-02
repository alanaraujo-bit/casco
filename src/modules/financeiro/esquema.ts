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

/* --------------------------------------------------------- contas a pagar */

/**
 * O lançamento de uma despesa ou custo.
 *
 * **`natureza` é escolhida, nunca deduzida.** Custo entra no CMV, despesa entra
 * em despesa operacional, e é essa separação que faz o DRE fechar — no legado
 * as duas linhas aparecem como `NaN`. Tentar adivinhar pelo texto da descrição
 * ("compra de garrafão" é custo, "conta de luz" é despesa) funcionaria em nove
 * de dez casos, e o décimo apareceria como um resultado errado que ninguém
 * consegue explicar. São dois botões; a operadora escolhe.
 */
export const CAMPOS_PAGAR = [
  'descricao',
  'fornecedorId',
  'natureza',
  'categoria',
  'valorPrevisto',
  'vencimento',
  'parcelas',
  'observacao',
] as const
export type CampoPagar = (typeof CAMPOS_PAGAR)[number]

export const esquemaPagar = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Informe do que se trata')
    .max(200, 'Máximo de 200 caracteres'),

  fornecedorId: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Fornecedor inválido')
    .transform((v) => v || null),

  natureza: z.enum(['custo', 'despesa'], { message: 'Escolha entre custo e despesa' }),

  categoria: z
    .string()
    .trim()
    .max(60, 'Máximo de 60 caracteres')
    .transform((v) => v || null),

  valorPrevisto: z
    .string()
    .transform(paraNumero)
    .refine((v) => Number.isFinite(v), 'Valor inválido')
    .refine((v) => v > 0, 'O valor precisa ser maior que zero'),

  vencimento: z
    .string()
    .trim()
    .min(1, 'Informe o vencimento')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),

  parcelas: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/\D/g, '')) || 1)
    .refine((v) => v >= 1 && v <= 36, 'Entre 1 e 36 parcelas'),

  observacao: z
    .string()
    .trim()
    .max(300, 'Máximo de 300 caracteres')
    .transform((v) => v || null),
})

export interface EstadoPagar {
  erro?: string
  campos?: Partial<Record<CampoPagar, string>>
  valores?: Partial<Record<CampoPagar, string>>
  tentativa?: number
  /** Preenchido no sucesso: quantas parcelas nasceram e a primeira a vencer. */
  sucesso?: { descricao: string; parcelas: number; total: number; primeiroVencimento: string }
}

/* ------------------------------------------------------ baixa de pagamento */

export const CAMPOS_QUITAR = ['contaPagarId', 'pagoEm', 'valorPago', 'contaId', 'formaId'] as const
export type CampoQuitar = (typeof CAMPOS_QUITAR)[number]

export const esquemaQuitar = z.object({
  contaPagarId: uuid,
  pagoEm: z
    .string()
    .trim()
    .min(1, 'Informe a data do pagamento')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  valorPago: z
    .string()
    .transform(paraNumero)
    .refine((v) => Number.isFinite(v), 'Valor inválido')
    .refine((v) => v > 0, 'O valor pago precisa ser maior que zero'),
  contaId: uuid,
  formaId: uuid,
})

export interface EstadoQuitar {
  erro?: string
  campos?: Partial<Record<CampoQuitar, string>>
  valores?: Partial<Record<CampoQuitar, string>>
  tentativa?: number
  sucesso?: {
    descricao: string
    valorPago: number
    conta: string
    /** Diferença para o previsto. Positivo = pagou menos do que estava previsto. */
    diferenca: number
  }
}
