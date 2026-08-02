import type { Falha } from '@/lib/erros'
import { z } from 'zod'
import { type TipoEstoque } from '@/db/schema'
import { paraNumero } from '@/modules/vendas/esquema'

/**
 * O que vale como movimento de estoque.
 *
 * Mesma decisão que organiza o módulo de vasilhame, e pelo mesmo motivo: **a
 * operadora nunca digita sinal.** Ela escolhe o que aconteceu e digita quantos,
 * sempre positivo, do jeito que se conta mercadoria no depósito. O sinal sai da
 * tabela `REGRA` abaixo, que é o espelho dos check constraints da
 * `migrations/0011_estoque.sql`.
 *
 * A distinção que este arquivo existe para preservar é entre **ajuste** e
 * **estorno**, porque as duas parecem a mesma coisa na hora e não são:
 *
 *   ajuste  — o registro estava certo e o mundo mudou. Contei e tinha menos.
 *   estorno — o mundo estava certo e o registro errou. Digitei 8000 em vez de 800.
 *
 * Confundir os dois é como o inventário deixa de ser auditável: o ajuste vira
 * o lixeiro onde todo erro de digitação é enterrado, e seis meses depois
 * ninguém sabe se faltou mercadoria ou faltou atenção. É exatamente o defeito
 * do sistema que estamos substituindo, na versão estoque.
 */

export type Direcao = 'entrada' | 'saida' | 'ambas'

export interface RegraTipo {
  rotulo: string
  /** Frase curta na tela. É o que evita a escolha errada de tipo. */
  ajuda: string
  direcao: Direcao
  /** Tem fornecedor e documento, e pode virar título em Contas a Pagar. */
  temFornecedor: boolean
  /** Vira custo no DRE, pela view `estoque_perdas`. */
  perda: boolean
  tom: 'sucesso' | 'info' | 'perigo' | 'alerta' | 'neutro'
  /** `false` para os tipos que só o sistema lança — a tela não os oferece. */
  lancavelNaMao: boolean
}

export const REGRA: Record<TipoEstoque, RegraTipo> = {
  producao: {
    rotulo: 'Produção',
    ajuda: 'Envasado aqui dentro. Entra no estoque e não é compra de ninguém.',
    direcao: 'entrada',
    temFornecedor: false,
    perda: false,
    tom: 'sucesso',
    lancavelNaMao: true,
  },
  compra: {
    rotulo: 'Compra',
    ajuda: 'Chegou de fornecedor. Pode gerar o título em Contas a Pagar.',
    direcao: 'entrada',
    temFornecedor: true,
    perda: false,
    tom: 'info',
    lancavelNaMao: true,
  },
  ajuste: {
    rotulo: 'Ajuste de inventário',
    ajuda: 'Acerto de contagem, depois de conferir o depósito no olho.',
    direcao: 'ambas',
    temFornecedor: false,
    perda: false,
    tom: 'neutro',
    lancavelNaMao: true,
  },
  perda: {
    rotulo: 'Perda',
    ajuda: 'Vencido, quebrado ou extraviado. Sai do estoque e vira custo.',
    direcao: 'saida',
    temFornecedor: false,
    perda: true,
    tom: 'perigo',
    lancavelNaMao: true,
  },
  devolucao: {
    rotulo: 'Devolução de cliente',
    ajuda: 'O produto voltou e está bom para vender de novo.',
    direcao: 'entrada',
    temFornecedor: false,
    perda: false,
    tom: 'alerta',
    lancavelNaMao: true,
  },
  venda: {
    // Lançada pelo PDV, dentro da mesma transação da venda. Oferecer "saída por
    // venda" na tela de estoque seria oferecer um jeito de baixar mercadoria
    // sem registrar dinheiro — o buraco por onde some o faturamento.
    rotulo: 'Venda',
    ajuda: 'Baixa automática do PDV.',
    direcao: 'saida',
    temFornecedor: false,
    perda: false,
    tom: 'neutro',
    lancavelNaMao: false,
  },
}

/**
 * Ordem na tela de lançamento: o que ela mais lança vem primeiro. `venda` está
 * de fora porque só o PDV a escreve — ver a nota em `REGRA.venda`.
 */
export const TIPOS_EM_ORDEM: TipoEstoque[] = ['producao', 'compra', 'ajuste', 'perda', 'devolucao']

export function rotuloTipo(tipo: string): string {
  return REGRA[tipo as TipoEstoque]?.rotulo ?? tipo
}

export function tomDoTipo(tipo: string): RegraTipo['tom'] {
  return REGRA[tipo as TipoEstoque]?.tom ?? 'neutro'
}

/**
 * A quantidade digitada (sempre positiva) vira a quantidade gravada (com sinal).
 *
 * `sentido` só é lido no ajuste — nos outros tipos o significado do lançamento
 * já determina a direção, e deixar a operadora escolher seria oferecer uma forma
 * de errar sem oferecer nada em troca.
 */
export function aplicarSinal(tipo: TipoEstoque, quantidade: number, sentido: Direcao): number {
  const direcao = REGRA[tipo].direcao === 'ambas' ? sentido : REGRA[tipo].direcao
  return direcao === 'entrada' ? Math.abs(quantidade) : -Math.abs(quantidade)
}

/* ------------------------------------------------------------------ zod */

const uuidOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Seleção inválida')
  .transform((v) => v || null)
  .nullable()

const TIPOS_MANUAIS = TIPOS_EM_ORDEM as [TipoEstoque, ...TipoEstoque[]]

export const esquemaMovimento = z
  .object({
    tipo: z.enum(TIPOS_MANUAIS, { message: 'Escolha o tipo do movimento' }),

    produtoId: z
      .string()
      .trim()
      .min(1, 'Escolha o produto')
      .refine((v) => z.string().uuid().safeParse(v).success, 'Produto inválido'),

    fornecedorId: uuidOpcional,

    documento: z
      .string()
      .trim()
      .max(40, 'Máximo de 40 caracteres')
      .transform((v) => v || null)
      .nullable(),

    /**
     * Sempre positiva. Aceita decimal porque nem tudo se conta por unidade — a
     * JM compra insumo por quilo. O teto de 999.999 é a diferença entre um dedo
     * escorregando no teclado e um custo médio que ninguém consegue explicar.
     */
    quantidade: z
      .string()
      .trim()
      .min(1, 'Informe a quantidade')
      .transform(paraNumero)
      .refine((v) => Number.isFinite(v), 'Quantidade inválida')
      .refine((v) => v > 0, 'Quantidade deve ser maior que zero')
      .refine((v) => v <= 999999, 'Quantidade acima do razoável — confira o número'),

    /**
     * Zero é válido e significa "não sei": o banco preenche com o custo médio
     * vigente. Ver o trigger `estoque_custo_padrao` na 0011 — sem ele, entrada
     * sem custo diluiria o custo médio de todo o estoque.
     */
    custoUnitario: z
      .string()
      .trim()
      .transform(paraNumero)
      .refine((v) => Number.isFinite(v), 'Custo inválido')
      .refine((v) => v >= 0, 'O custo não pode ser negativo')
      .refine((v) => v <= 9999999, 'Custo acima do razoável — confira o número'),

    /** Só o ajuste usa. Os outros tipos ignoram. */
    sentido: z
      .string()
      .trim()
      .transform((v): Direcao => (v === 'saida' ? 'saida' : 'entrada')),

    /** Marcado na compra: gera o título em Contas a Pagar pelo total da entrada. */
    gerarContaPagar: z
      .string()
      .trim()
      .transform((v) => v === 'on' || v === 'true'),

    vencimento: z
      .string()
      .trim()
      .transform((v) => v || null)
      .nullable(),

    observacao: z
      .string()
      .trim()
      .max(300, 'Máximo de 300 caracteres')
      .transform((v) => v || null)
      .nullable(),
  })
  /**
   * As mesmas travas que o banco faz. Aqui elas viram frase em português junto
   * do campo errado; lá elas garantem que nenhum caminho passe por cima —
   * inclusive um script rodado fora da aplicação.
   */
  .refine((d) => REGRA[d.tipo].temFornecedor || d.fornecedorId === null, {
    message: 'Só a compra tem fornecedor',
    path: ['fornecedorId'],
  })
  .refine((d) => !d.gerarContaPagar || REGRA[d.tipo].temFornecedor, {
    message: 'Só a compra gera título a pagar',
    path: ['gerarContaPagar'],
  })
  /**
   * Título a pagar exige vencimento e valor. Sem o vencimento não há como
   * cobrar nem prever caixa; com custo zero o título nasceria de R$ 0,00 e
   * poluiria Contas a Pagar com linha que ninguém vai baixar.
   */
  .refine((d) => !d.gerarContaPagar || (d.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(d.vencimento)), {
    message: 'Informe o vencimento do título',
    path: ['vencimento'],
  })
  .refine((d) => !d.gerarContaPagar || d.custoUnitario > 0, {
    message: 'Para gerar o título, informe o custo unitário',
    path: ['custoUnitario'],
  })

export type MovimentoValidado = z.output<typeof esquemaMovimento>

export const CAMPOS_MOVIMENTO = [
  'tipo',
  'produtoId',
  'fornecedorId',
  'documento',
  'quantidade',
  'custoUnitario',
  'sentido',
  'gerarContaPagar',
  'vencimento',
  'observacao',
] as const

export type CampoMovimento = (typeof CAMPOS_MOVIMENTO)[number]

export interface EstadoFormularioMovimento {
  erro?: Falha | string
  campos?: Partial<Record<CampoMovimento, string>>
  valores?: Partial<Record<CampoMovimento, string>>
  tentativa?: number
  /** Preenchido no sucesso: alimenta o recibo que fica na tela após lançar. */
  sucesso?: {
    tipo: TipoEstoque
    quantidade: number
    produto: string
    unidade: string
    /** Saldo do produto depois do lançamento, já com o trigger aplicado. */
    saldo: number
    custoMedio: number
    /** Preenchido quando a compra gerou título em Contas a Pagar. */
    tituloGerado: { valor: number; vencimento: string } | null
  }
}
