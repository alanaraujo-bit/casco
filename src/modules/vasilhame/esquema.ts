import { z } from 'zod'
import { MOTIVOS_VASILHAME, type MotivoVasilhame } from '@/db/schema'

/**
 * O que vale como movimento de vasilhame.
 *
 * Este arquivo existe para uma decisão só, e ela é o módulo inteiro:
 * **a operadora nunca digita sinal.** Ela escolhe o motivo e digita quantos
 * galões — sempre um número positivo, do jeito que se conta galão no balcão.
 * O sinal sai daqui, da tabela `REGRA` abaixo.
 *
 * A alternativa seria um campo "quantidade" que aceita negativo, e a tela
 * explicando que menos é devolução. É assim que se lança `-3` num `entregue`
 * às sete da manhã: o banco recusa pelo check constraint, a operadora vê um
 * erro de Postgres, e no dia seguinte ela aprende a "tentar o outro sinal até
 * passar". O constraint continua lá como última linha de defesa — mas o certo
 * é a tela nunca chegar perto dele.
 *
 * A regra de ouro do produto, repetida aqui porque é onde ela é aplicada:
 * **baixa de vasilhame é evento de estoque, jamais uma venda.** Nada neste
 * arquivo importa venda, preço ou conta a receber.
 */

/** Para onde o galão vai, do ponto de vista da empresa. */
export type Direcao =
  /** Saiu da empresa. `quantidade > 0` — o cliente passa a dever mais. */
  | 'saida'
  /** Voltou para a empresa. `quantidade < 0` — o cliente deve menos. */
  | 'entrada'
  /** Depende: só o ajuste de inventário, que acerta contagem nos dois sentidos. */
  | 'ambas'

/** O cliente é obrigatório, proibido, ou tanto faz — espelha os check constraints da 0005. */
export type ExigenciaCliente = 'obrigatorio' | 'proibido' | 'opcional'

export interface RegraMotivo {
  rotulo: string
  /** Frase curta na tela de baixa. É o que evita a escolha errada de motivo. */
  ajuda: string
  direcao: Direcao
  cliente: ExigenciaCliente
  /** Vira custo no DRE. Os três motivos que o sistema antigo lançava como venda. */
  perda: boolean
  /** Como o selo aparece na listagem e no extrato. */
  tom: 'sucesso' | 'info' | 'perigo' | 'alerta' | 'neutro'
}

/**
 * Os oito motivos e o que cada um significa.
 *
 * As colunas `direcao` e `cliente` não são documentação: são exatamente os
 * `check constraints` de `migrations/0005_vasilhame.sql`, escritos uma segunda
 * vez em TypeScript para que a tela já nasça obedecendo. Se um dia divergirem,
 * o banco ganha — ele é quem recusa.
 */
export const REGRA: Record<MotivoVasilhame, RegraMotivo> = {
  entregue: {
    rotulo: 'Entregue ao cliente',
    ajuda: 'O cliente levou o galão e passa a dever a devolução.',
    direcao: 'saida',
    cliente: 'obrigatorio',
    perda: false,
    tom: 'info',
  },
  devolvido: {
    rotulo: 'Devolvido pelo cliente',
    ajuda: 'O cliente trouxe o galão de volta, inteiro. Quita a dívida dele.',
    direcao: 'entrada',
    cliente: 'obrigatorio',
    perda: false,
    tom: 'sucesso',
  },
  quebrado: {
    rotulo: 'Quebrado',
    ajuda: 'Galão inutilizado. Sai do patrimônio e vira custo — nunca receita.',
    direcao: 'entrada',
    cliente: 'opcional',
    perda: true,
    tom: 'perigo',
  },
  trincado: {
    rotulo: 'Trincado',
    ajuda: 'Ainda inteiro, mas fora de circulação. Também é custo.',
    direcao: 'entrada',
    cliente: 'opcional',
    perda: true,
    tom: 'alerta',
  },
  perdido: {
    rotulo: 'Perdido pelo cliente',
    ajuda: 'O cliente não devolveu e não vai devolver. Baixa a dívida e vira custo.',
    direcao: 'entrada',
    cliente: 'obrigatorio',
    perda: true,
    tom: 'perigo',
  },
  enviado_fabrica: {
    rotulo: 'Enviado à fábrica',
    ajuda: 'Transferência interna para envase. Não é dívida de ninguém.',
    direcao: 'saida',
    cliente: 'proibido',
    perda: false,
    tom: 'neutro',
  },
  retornou_fabrica: {
    rotulo: 'Retornou da fábrica',
    ajuda: 'Voltou do envase para o depósito.',
    direcao: 'entrada',
    cliente: 'proibido',
    perda: false,
    tom: 'neutro',
  },
  ajuste_inventario: {
    rotulo: 'Ajuste de inventário',
    ajuda: 'Acerto de contagem, depois de conferir o depósito no olho.',
    direcao: 'ambas',
    cliente: 'opcional',
    perda: false,
    tom: 'neutro',
  },
}

/** Ordem de exibição na tela de baixa: o que ela mais lança vem primeiro. */
export const MOTIVOS_EM_ORDEM: MotivoVasilhame[] = [
  'devolvido',
  'entregue',
  'quebrado',
  'trincado',
  'perdido',
  'enviado_fabrica',
  'retornou_fabrica',
  'ajuste_inventario',
]

export const MOTIVOS_PERDA_LISTA = MOTIVOS_EM_ORDEM.filter((m) => REGRA[m].perda)

export function rotuloMotivo(motivo: string): string {
  return REGRA[motivo as MotivoVasilhame]?.rotulo ?? motivo
}

export function ehPerda(motivo: string): boolean {
  return REGRA[motivo as MotivoVasilhame]?.perda ?? false
}

/**
 * `3 quebrados` · `1 perdido` — como se lê um resumo de perdas em português.
 *
 * Não sai de `rotulo` com um `s` no fim porque "Perdido pelo cliente" viraria
 * "perdido pelo clientes". O plural de rótulo composto não é regra de string, é
 * vocabulário — então mora numa tabela, ao lado do resto do vocabulário.
 */
const PLURAL_PERDA: Record<MotivoPerdaLista, [string, string]> = {
  quebrado: ['quebrado', 'quebrados'],
  trincado: ['trincado', 'trincados'],
  perdido: ['perdido', 'perdidos'],
}

type MotivoPerdaLista = 'quebrado' | 'trincado' | 'perdido'

export function resumoDePerda(motivo: string, unidades: number): string {
  const par = PLURAL_PERDA[motivo as MotivoPerdaLista]
  if (!par) return `${unidades} ${rotuloMotivo(motivo).toLowerCase()}`
  return `${unidades} ${unidades === 1 ? par[0] : par[1]}`
}

/**
 * A quantidade digitada (sempre positiva) vira a quantidade gravada (com sinal).
 *
 * `sentido` só é lido no ajuste de inventário — nos outros sete motivos o
 * significado do movimento já determina a direção, e deixar a operadora
 * escolher seria oferecer uma forma de errar sem oferecer nada em troca.
 */
export function aplicarSinal(
  motivo: MotivoVasilhame,
  quantidade: number,
  sentido: Direcao,
): number {
  const direcao = REGRA[motivo].direcao === 'ambas' ? sentido : REGRA[motivo].direcao
  return direcao === 'entrada' ? -Math.abs(quantidade) : Math.abs(quantidade)
}

/* ------------------------------------------------------------------ zod */

const uuidOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Seleção inválida')
  .transform((v) => v || null)
  .nullable()

export const esquemaMovimento = z
  .object({
    motivo: z.enum(MOTIVOS_VASILHAME, { message: 'Escolha o motivo da baixa' }),

    produtoId: z
      .string()
      .trim()
      .min(1, 'Escolha o vasilhame')
      .refine((v) => z.string().uuid().safeParse(v).success, 'Vasilhame inválido'),

    clienteId: uuidOpcional,

    /**
     * Sempre positiva. O teto de 9999 não é burocracia: é a diferença entre
     * um dedo escorregando no teclado numérico e um saldo de cliente que
     * ninguém consegue explicar depois.
     */
    quantidade: z
      .string()
      .trim()
      .min(1, 'Informe a quantidade')
      .transform((v) => Number(v.replace(/\D/g, '')))
      .refine((v) => Number.isInteger(v) && v > 0, 'Quantidade deve ser maior que zero')
      .refine((v) => v <= 9999, 'Quantidade acima do razoável — confira o número'),

    /** Só o ajuste de inventário usa. Os outros motivos ignoram. */
    sentido: z
      .string()
      .trim()
      .transform((v): Direcao => (v === 'entrada' ? 'entrada' : 'saida')),

    observacao: z
      .string()
      .trim()
      .max(300, 'Máximo de 300 caracteres')
      .transform((v) => v || null)
      .nullable(),
  })
  /**
   * As duas travas que o banco também faz. Aqui elas viram frase em português
   * junto do campo errado; lá elas são a garantia de que nenhum caminho passa
   * por cima — inclusive um script que alguém rode fora da aplicação.
   */
  .refine((d) => REGRA[d.motivo].cliente !== 'obrigatorio' || d.clienteId !== null, {
    message: 'Este motivo exige um cliente',
    path: ['clienteId'],
  })
  .refine((d) => REGRA[d.motivo].cliente !== 'proibido' || d.clienteId === null, {
    message: 'Movimento de fábrica é interno e não tem cliente',
    path: ['clienteId'],
  })

export type MovimentoValidado = z.output<typeof esquemaMovimento>

export const CAMPOS_MOVIMENTO = [
  'motivo',
  'produtoId',
  'clienteId',
  'quantidade',
  'sentido',
  'observacao',
] as const

export type CampoMovimento = (typeof CAMPOS_MOVIMENTO)[number]

export interface EstadoFormularioMovimento {
  erro?: string
  campos?: Partial<Record<CampoMovimento, string>>
  valores?: Partial<Record<CampoMovimento, string>>
  tentativa?: number
  /** Preenchido no sucesso: alimenta o recibo que fica na tela após lançar. */
  sucesso?: {
    motivo: MotivoVasilhame
    quantidade: number
    produto: string
    cliente: string | null
    saldoCliente: number | null
  }
}
