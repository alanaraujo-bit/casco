import {
  bigint,
  boolean,
  doublePrecision,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { companies } from './tenancy'

/**
 * Espelho tipado das tabelas de `migrations/0004_cadastros.sql`.
 *
 * O SQL e a fonte da verdade, nao este arquivo. RLS, trigger e check constraint
 * nao tem representacao no Drizzle — quem garante as regras e o banco. Aqui so
 * existe o tipo, para o TypeScript acusar coluna que nao existe antes de virar
 * erro em producao.
 */

/** Contador por (empresa, entidade) que alimenta os codigos que o usuario le. */
export const sequencias = pgTable(
  'sequencias',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    nome: text('nome').notNull(),
    valor: bigint('valor', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.nome] })],
)

export const tabelasPreco = pgTable(
  'tabelas_preco',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    nome: text('nome').notNull(),
    padrao: boolean('padrao').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tabelas_preco_company_idx').on(t.companyId, t.nome)],
)

export const produtos = pgTable(
  'produtos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    /** Atribuido por trigger no insert. Nunca preencher na aplicacao. */
    codigo: bigint('codigo', { mode: 'number' }),
    nome: text('nome').notNull(),
    sku: text('sku'),
    categoria: text('categoria'),
    unidade: text('unidade').notNull().default('un'),
    precoPadrao: numeric('preco_padrao', { precision: 12, scale: 2 }).notNull().default('0'),
    custo: numeric('custo', { precision: 12, scale: 2 }).notNull().default('0'),
    /** Produto vendido que gera comodato (Agua 20L), nao o galao em si. */
    retornavel: boolean('retornavel').notNull().default(false),
    /** O galao vazio correspondente. Obrigatorio quando `retornavel`. */
    vasilhameId: uuid('vasilhame_id'),
    controlaEstoque: boolean('controla_estoque').notNull().default(true),
    estoqueMinimo: numeric('estoque_minimo', { precision: 12, scale: 3 }).notNull().default('0'),
    estoqueMaximo: numeric('estoque_maximo', { precision: 12, scale: 3 }).notNull().default('0'),
    ncm: text('ncm'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('produtos_company_idx').on(t.companyId, t.nome),
    uniqueIndex('produtos_codigo_unico').on(t.companyId, t.codigo),
  ],
)

export const precos = pgTable(
  'precos',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    tabelaId: uuid('tabela_id')
      .notNull()
      .references(() => tabelasPreco.id, { onDelete: 'cascade' }),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id, { onDelete: 'cascade' }),
    preco: numeric('preco', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tabelaId, t.produtoId] }),
    index('precos_company_idx').on(t.companyId, t.produtoId),
  ],
)

/** Os quatro tipos que definem por qual tabela de preco o cliente paga. */
export const TIPOS_CLIENTE = ['revenda', 'mercado', 'restaurante', 'consumidor'] as const
export type TipoCliente = (typeof TIPOS_CLIENTE)[number]

export const clientes = pgTable(
  'clientes',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    codigo: bigint('codigo', { mode: 'number' }),
    nome: text('nome').notNull(),
    documento: text('documento'),
    telefone: text('telefone'),
    email: text('email'),
    tipo: text('tipo', { enum: TIPOS_CLIENTE }).notNull().default('consumidor'),

    cep: text('cep'),
    logradouro: text('logradouro'),
    numero: text('numero'),
    complemento: text('complemento'),
    bairro: text('bairro'),
    cidade: text('cidade'),
    uf: text('uf'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    pontoReferencia: text('ponto_referencia'),

    tabelaPrecoId: uuid('tabela_preco_id').references(() => tabelasPreco.id, {
      onDelete: 'set null',
    }),
    limiteCredito: numeric('limite_credito', { precision: 12, scale: 2 }).notNull().default('0'),
    observacoes: text('observacoes'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('clientes_company_idx').on(t.companyId, t.nome),
    uniqueIndex('clientes_codigo_unico').on(t.companyId, t.codigo),
  ],
)

export const fornecedores = pgTable(
  'fornecedores',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    codigo: bigint('codigo', { mode: 'number' }),
    nome: text('nome').notNull(),
    documento: text('documento'),
    telefone: text('telefone'),
    email: text('email'),
    cidade: text('cidade'),
    uf: text('uf'),
    observacoes: text('observacoes'),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fornecedores_company_idx').on(t.companyId, t.nome),
    uniqueIndex('fornecedores_codigo_unico').on(t.companyId, t.codigo),
  ],
)

export type TabelaPreco = typeof tabelasPreco.$inferSelect
export type Produto = typeof produtos.$inferSelect
export type NovoProduto = typeof produtos.$inferInsert
export type Preco = typeof precos.$inferSelect
export type Cliente = typeof clientes.$inferSelect
export type NovoCliente = typeof clientes.$inferInsert
export type Fornecedor = typeof fornecedores.$inferSelect
export type NovoFornecedor = typeof fornecedores.$inferInsert
