import {
  bigint,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { clientes, fornecedores, produtos } from './cadastros'
import { plataformaAdmins } from './plataforma'
import { companies, users } from './tenancy'

/**
 * Espelho tipado de `migrations/0006_vendas_financeiro_estoque.sql`.
 *
 * A ordem em que as colunas aparecem na tela e a ordem aqui sao independentes:
 * aqui vale a do SQL.
 */

/* ------------------------------------------------------ meios de recebimento */

export const contasBancarias = pgTable(
  'contas_bancarias',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    nome: text('nome').notNull(),
    tipo: text('tipo', { enum: ['caixa', 'banco'] }).notNull().default('banco'),
    saldoInicial: numeric('saldo_inicial', { precision: 12, scale: 2 }).notNull().default('0'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contas_bancarias_company_idx').on(t.companyId, t.nome)],
)

export const TIPOS_PAGAMENTO = [
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'boleto',
  'a_prazo',
] as const
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number]

export const formasPagamento = pgTable(
  'formas_pagamento',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    nome: text('nome').notNull(),
    tipo: text('tipo', { enum: TIPOS_PAGAMENTO }).notNull(),
    /** Cartao de debito come 1,49% da venda. Sem este campo, o custo fica invisivel. */
    taxaPercentual: numeric('taxa_percentual', { precision: 6, scale: 4 }).notNull().default('0'),
    prazoDias: integer('prazo_dias').notNull().default(0),
    contaId: uuid('conta_id').references(() => contasBancarias.id, { onDelete: 'set null' }),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('formas_pagamento_company_idx').on(t.companyId, t.nome)],
)

/* --------------------------------------------------------------------- vendas */

export const ORIGENS_VENDA = ['balcao', 'pdv', 'entrega', 'whatsapp'] as const
export const STATUS_VENDA = ['orcamento', 'confirmada', 'cancelada'] as const

export const vendas = pgTable(
  'vendas',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    codigo: bigint('codigo', { mode: 'number' }),
    /** "Operacao" na listagem de vendas. */
    origem: text('origem', { enum: ORIGENS_VENDA }).notNull().default('balcao'),
    /** `null` = venda avulsa de balcao. Exigir cadastro aqui e atrito que mata a adocao. */
    clienteId: uuid('cliente_id').references(() => clientes.id),
    vendedorId: uuid('vendedor_id').references(() => users.id),
    status: text('status', { enum: STATUS_VENDA }).notNull().default('confirmada'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    desconto: numeric('desconto', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    taxas: numeric('taxas', { precision: 12, scale: 2 }).notNull().default('0'),
    comissao: numeric('comissao', { precision: 12, scale: 2 }).notNull().default('0'),
    parcelas: integer('parcelas').notNull().default(1),
    observacao: text('observacao'),
    orcamentoNumero: bigint('orcamento_numero', { mode: 'number' }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendas_company_idx').on(t.companyId, t.criadoEm),
    index('vendas_cliente_idx').on(t.companyId, t.clienteId, t.criadoEm),
  ],
)

export const vendaItens = pgTable(
  'venda_itens',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    vendaId: uuid('venda_id')
      .notNull()
      .references(() => vendas.id, { onDelete: 'cascade' }),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id),
    quantidade: numeric('quantidade', { precision: 12, scale: 3 }).notNull(),
    precoUnitario: numeric('preco_unitario', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    /** Galoes vazios entregues junto com a compra. Por item, nao por venda. */
    vasilhameDevolvido: integer('vasilhame_devolvido').notNull().default(0),
  },
  (t) => [
    index('venda_itens_venda_idx').on(t.vendaId),
    index('venda_itens_produto_idx').on(t.companyId, t.produtoId),
  ],
)

export const pagamentos = pgTable(
  'pagamentos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    vendaId: uuid('venda_id').references(() => vendas.id, { onDelete: 'cascade' }),
    formaId: uuid('forma_id').references(() => formasPagamento.id),
    contaId: uuid('conta_id').references(() => contasBancarias.id),
    valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
    taxa: numeric('taxa', { precision: 12, scale: 2 }).notNull().default('0'),
    recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pagamentos_company_idx').on(t.companyId, t.recebidoEm)],
)

/* ----------------------------------------------------------------- financeiro */

export const contasReceber = pgTable(
  'contas_receber',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    origem: text('origem').notNull().default('manual'),
    vendaId: uuid('venda_id').references(() => vendas.id, { onDelete: 'set null' }),
    codigo: bigint('codigo', { mode: 'number' }),
    clienteId: uuid('cliente_id').references(() => clientes.id),
    descricao: text('descricao'),
    emissao: date('emissao').notNull(),
    valorTotal: numeric('valor_total', { precision: 12, scale: 2 }).notNull(),
    parcelaNumero: integer('parcela_numero').notNull().default(1),
    parcelaTotal: integer('parcela_total').notNull().default(1),
    valorParcela: numeric('valor_parcela', { precision: 12, scale: 2 }).notNull(),
    vencimento: date('vencimento').notNull(),
    /** Situacao e derivada de `pagoEm` + `vencimento`. Nunca digitada. */
    pagoEm: date('pago_em'),
    valorPago: numeric('valor_pago', { precision: 12, scale: 2 }),
    contaId: uuid('conta_id').references(() => contasBancarias.id),
    formaId: uuid('forma_id').references(() => formasPagamento.id),
    taxas: numeric('taxas', { precision: 12, scale: 2 }).notNull().default('0'),
    observacao: text('observacao'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contas_receber_company_idx').on(t.companyId, t.vencimento),
    index('contas_receber_cliente_idx').on(t.companyId, t.clienteId, t.vencimento),
  ],
)

export const contasPagar = pgTable(
  'contas_pagar',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    codigo: bigint('codigo', { mode: 'number' }),
    /**
     * Quem escreveu a linha. `estoque` = compra de mercadoria, e o DRE a ignora:
     * o custo dela ja entra pelo CMV quando o produto sai. Somar as duas contaria
     * a mesma compra duas vezes. Ver a 0012.
     */
    origem: text('origem', { enum: ['manual', 'estoque'] }).notNull().default('manual'),
    fornecedorId: uuid('fornecedor_id').references(() => fornecedores.id),
    descricao: text('descricao').notNull(),
    /** Custo entra no CMV, despesa entra em despesa operacional. E o que faz o DRE fechar. */
    natureza: text('natureza', { enum: ['custo', 'despesa'] }).notNull().default('despesa'),
    categoria: text('categoria'),
    emissao: date('emissao').notNull(),
    parcelaNumero: integer('parcela_numero').notNull().default(1),
    parcelaTotal: integer('parcela_total').notNull().default(1),
    vencimento: date('vencimento').notNull(),
    valorPrevisto: numeric('valor_previsto', { precision: 12, scale: 2 }).notNull(),
    pagoEm: date('pago_em'),
    valorPago: numeric('valor_pago', { precision: 12, scale: 2 }),
    contaId: uuid('conta_id').references(() => contasBancarias.id),
    formaId: uuid('forma_id').references(() => formasPagamento.id),
    observacao: text('observacao'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contas_pagar_company_idx').on(t.companyId, t.vencimento)],
)

/**
 * Caixa: so dinheiro que entrou ou saiu de fato.
 *
 * Perda de vasilhame nao entra aqui — vasilhame quebrado e custo, mas nenhum real
 * sai do caixa quando ele quebra. Ver `vasilhame.ts` e a nota na migration 0005.
 */
export const caixaMovimentos = pgTable(
  'caixa_movimentos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    contaId: uuid('conta_id')
      .notNull()
      .references(() => contasBancarias.id),
    data: date('data').notNull(),
    sentido: text('sentido', { enum: ['entrada', 'saida'] }).notNull(),
    valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
    categoria: text('categoria'),
    descricao: text('descricao'),
    origem: text('origem', { enum: ['venda', 'receber', 'pagar', 'manual', 'transferencia'] }),
    origemId: uuid('origem_id'),
    usuarioId: uuid('usuario_id').references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('caixa_company_idx').on(t.companyId, t.data)],
)

/* -------------------------------------------------------------------- estoque */

/**
 * Espelho de `estoque_movimentos_tipo_check` na `migrations/0011_estoque.sql`.
 *
 * `compra` e `producao` sao entradas diferentes de proposito: a JM e fabrica de
 * agua, entao o vasilhame envasado nasce dentro de casa e nao deve nada a ninguem,
 * enquanto a tampa e o lacre chegam de fornecedor e podem virar Conta a Pagar.
 * Um `entrada` generico obrigaria a adivinhar qual era, meses depois, olhando se
 * o campo fornecedor esta preenchido.
 */
export const TIPOS_ESTOQUE = [
  'compra',
  'producao',
  'venda',
  'devolucao',
  'perda',
  'ajuste',
] as const

export type TipoEstoque = (typeof TIPOS_ESTOQUE)[number]

export const estoqueMovimentos = pgTable(
  'estoque_movimentos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id),
    /** `> 0` entrou · `< 0` saiu. Mesma convencao do vasilhame, de proposito. */
    quantidade: numeric('quantidade', { precision: 12, scale: 3 }).notNull(),
    tipo: text('tipo', { enum: TIPOS_ESTOQUE }).notNull(),
    custoUnitario: numeric('custo_unitario', { precision: 12, scale: 2 }).notNull().default('0'),
    /** So a compra tem. O check `estoque_mov_fornecedor_so_compra` garante. */
    fornecedorId: uuid('fornecedor_id').references(() => fornecedores.id),
    /** Numero da nota ou romaneio. Livre: nem todo fornecedor da JM emite nota. */
    documento: text('documento'),
    origem: text('origem'),
    origemId: uuid('origem_id'),
    usuarioId: uuid('usuario_id').references(() => users.id),
    observacao: text('observacao'),
    /** Preenchido no estorno: aponta o movimento desfeito. Nunca se edita, se estorna. */
    estornoDe: uuid('estorno_de'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    /** Nulo enquanto o lançamento vale. Preenchido pela exclusão da tela — a linha não some do banco. */
    excluidoEm: timestamp('excluido_em', { withTimezone: true }),
    excluidoPor: uuid('excluido_por').references(() => users.id),
    /**
     * Paralelo a `usuarioId`/`excluidoPor`, para sessão de suporte Aionix (sem
     * linha em `users`). Nunca preenchido junto com o par de `users` — ver a
     * nota em `autorDoLancamento`, `src/lib/sessao.ts`.
     */
    adminId: uuid('admin_id').references(() => plataformaAdmins.id),
    excluidoPorAdminId: uuid('excluido_por_admin_id').references(() => plataformaAdmins.id),
  },
  (t) => [
    index('estoque_mov_company_idx').on(t.companyId, t.criadoEm),
    index('estoque_mov_produto_idx').on(t.companyId, t.produtoId, t.criadoEm),
  ],
)

/** Mantido por trigger. Nunca escrever aqui pela aplicacao — lance o movimento. */
export const estoqueSaldos = pgTable(
  'estoque_saldos',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    produtoId: uuid('produto_id')
      .primaryKey()
      .references(() => produtos.id, { onDelete: 'cascade' }),
    quantidade: numeric('quantidade', { precision: 12, scale: 3 }).notNull().default('0'),
    /** Custo medio movel ponderado — a coluna "Custo Medio Unit." da listagem de estoque. */
    custoMedio: numeric('custo_medio', { precision: 12, scale: 4 }).notNull().default('0'),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('estoque_saldos_company_idx').on(t.companyId)],
)

export type ContaBancaria = typeof contasBancarias.$inferSelect
export type FormaPagamento = typeof formasPagamento.$inferSelect
export type Venda = typeof vendas.$inferSelect
export type NovaVenda = typeof vendas.$inferInsert
export type VendaItem = typeof vendaItens.$inferSelect
export type Pagamento = typeof pagamentos.$inferSelect
export type ContaReceber = typeof contasReceber.$inferSelect
export type NovaContaReceber = typeof contasReceber.$inferInsert
export type ContaPagar = typeof contasPagar.$inferSelect
export type CaixaMovimento = typeof caixaMovimentos.$inferSelect
export type EstoqueMovimento = typeof estoqueMovimentos.$inferSelect
export type EstoqueSaldo = typeof estoqueSaldos.$inferSelect
