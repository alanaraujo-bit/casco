import type { Falha } from '@/lib/erros'
import { z } from 'zod'

/**
 * O que vale como venda de balcão.
 *
 * A decisão que organiza este arquivo: **preço não vem do navegador.** O
 * carrinho manda produto e quantidade; quem diz quanto custa é o servidor,
 * lendo a tabela de preço do cliente. Aceitar o preço que a tela enviou seria
 * publicar um formulário onde qualquer requisição forjada compra água a R$ 0,01
 * — e, pior no dia a dia, faria a tela e o banco discordarem sobre o
 * faturamento sempre que um preço mudasse no meio do expediente.
 *
 * O desconto é a exceção deliberada: ele é uma decisão humana no balcão, então
 * é digitado, é em reais sobre o total, e fica registrado na venda como número
 * próprio — nunca embutido no preço do item. O relatório precisa conseguir
 * responder "quanto demos de desconto este mês", e isso só existe se o desconto
 * for uma coluna, não uma subtração invisível.
 */

/** `1.234,56` · `1234,56` · `1234.56` → `1234.56`. Vazio é zero, não erro. */
export function paraNumero(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, '')
  if (!limpo) return 0
  // Vírgula é o separador decimal de quem digita; ponto é milhar. O contrário
  // ("1.50" querendo dizer um e cinquenta) vira 150 se a gente adivinhar errado
  // — então só tratamos ponto como decimal quando não há vírgula nenhuma.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  const valor = Number(normalizado)
  return Number.isFinite(valor) ? valor : NaN
}

/** Centavos são a unidade de conta aqui: somar float rende `29.999999999999996`. */
export function centavos(valor: number): number {
  return Math.round(valor * 100)
}

export function deCentavos(valor: number): number {
  return valor / 100
}

const uuid = z.string().trim().refine((v) => z.string().uuid().safeParse(v).success, 'Seleção inválida')

/**
 * Uma linha do carrinho, como ela chega do navegador.
 *
 * `precoUnitario` está ausente de propósito — ver o cabeçalho do arquivo.
 */
export const esquemaItem = z.object({
  produtoId: uuid,
  quantidade: z
    .number()
    .int('Quantidade deve ser um número inteiro')
    .positive('Quantidade deve ser maior que zero')
    .max(9999, 'Quantidade acima do razoável'),
  /**
   * Galões vazios que o cliente entregou junto, por produto.
   *
   * Fica no item e não na venda porque é por produto: ele pode trocar 10 galões
   * de 20L e nenhum de 10L. Somar tudo numa caixa só de "vasilhames devolvidos"
   * é como o saldo de comodato começa a mentir.
   */
  vasilhameDevolvido: z.number().int().min(0).max(9999),
})

export type ItemCarrinho = z.infer<typeof esquemaItem>

export const CAMPOS_VENDA = [
  'itens',
  'clienteId',
  'formaId',
  'desconto',
  'parcelas',
  'valorRecebido',
  'observacao',
] as const

export type CampoVenda = (typeof CAMPOS_VENDA)[number]

export const esquemaVenda = z.object({
  itens: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v || '[]') as unknown
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Carrinho inválido' })
        return z.NEVER
      }
    })
    .pipe(z.array(esquemaItem).min(1, 'Adicione ao menos um produto à venda')),

  /** Vazio = venda avulsa de balcão. Exigir cadastro aqui mataria a adoção. */
  clienteId: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Cliente inválido')
    .transform((v) => v || null),

  formaId: uuid,

  desconto: z
    .string()
    .transform(paraNumero)
    .refine((v) => Number.isFinite(v), 'Desconto inválido')
    .refine((v) => v >= 0, 'Desconto não pode ser negativo'),

  parcelas: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/\D/g, '')) || 1)
    .refine((v) => v >= 1 && v <= 36, 'Entre 1 e 36 parcelas'),

  /** Só serve para calcular troco. Não vira dado: o que se grava é o total. */
  valorRecebido: z
    .string()
    .transform(paraNumero)
    .refine((v) => Number.isFinite(v), 'Valor recebido inválido'),

  observacao: z
    .string()
    .trim()
    .max(300, 'Máximo de 300 caracteres')
    .transform((v) => v || null),
})

export type VendaValidada = z.output<typeof esquemaVenda>

/** Uma linha do cupom impresso — o que o cliente confere no papel. */
export interface ItemCupom {
  produto: string
  quantidade: number
  precoUnitario: number
  total: number
}

/** O recibo que fica na tela depois de fechar — é o que a operadora lê em voz alta. */
export interface ReciboVenda {
  vendaId: string
  codigo: number | null
  cliente: string | null
  /** `null` quando o cliente não tem endereço cadastrado. */
  clienteEndereco: string | null
  empresa: string
  /** Data e hora do fechamento, já formatada no fuso da loja — ver `formatarDataHora`. */
  emitidoEm: string
  itens: number
  itensDetalhe: ItemCupom[]
  subtotal: number
  desconto: number
  total: number
  /** Nome da forma escolhida, como aparece no cadastro. */
  forma: string
  /** `true` quando a venda virou título em Contas a Receber em vez de dinheiro. */
  aPrazo: boolean
  parcelas: number
  /** Primeiro vencimento, quando a prazo. */
  primeiroVencimento: string | null
  /** Taxa da maquininha descontada da entrada de caixa. Zero nas outras formas. */
  taxa: number
  troco: number | null
  /** Galões que saíram no comodato desta venda — o que o cliente passou a dever. */
  vasilhameEntregue: number
  vasilhameDevolvido: number
  /** Saldo de comodato do cliente depois desta venda, quando há cliente. */
  saldoVasilhame: number | null
}

export interface EstadoVenda {
  erro?: Falha | string
  campos?: Partial<Record<CampoVenda, string>>
  tentativa?: number
  recibo?: ReciboVenda
}
