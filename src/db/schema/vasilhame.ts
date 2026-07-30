import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { clientes, produtos } from './cadastros'
import { companies, users } from './tenancy'

/**
 * Espelho tipado de `migrations/0005_vasilhame.sql`.
 *
 * A regra que este modulo existe para proteger nao esta neste arquivo, e sim no
 * SQL e nos check constraints: **baixa de vasilhame e evento de estoque, jamais
 * uma venda.** Nenhum tipo daqui referencia venda, pagamento ou conta a receber
 * — e isso e proposital, nao esquecimento.
 */

/**
 * Os oito motivos. `motivo` e o campo que nao existe no sistema antigo, e a
 * falta dele e a causa raiz das vendas de R$ 0,13 (auditoria §5).
 */
export const MOTIVOS_VASILHAME = [
  'entregue',
  'devolvido',
  'quebrado',
  'trincado',
  'perdido',
  'enviado_fabrica',
  'retornou_fabrica',
  'ajuste_inventario',
] as const
export type MotivoVasilhame = (typeof MOTIVOS_VASILHAME)[number]

/** Os tres motivos que viram custo. Usado pelo DRE e pelo painel. */
export const MOTIVOS_PERDA = ['quebrado', 'trincado', 'perdido'] as const
export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]

export const ORIGENS_VASILHAME = ['venda', 'rota', 'balcao', 'ajuste', 'inventario'] as const

export const vasilhameMovimentos = pgTable(
  'vasilhame_movimentos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    /** `null` = movimento interno (deposito, fabrica). Nao e dado faltando. */
    clienteId: uuid('cliente_id').references(() => clientes.id),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id),
    /** `> 0` saiu da empresa · `< 0` voltou para a empresa. O banco valida o sinal por motivo. */
    quantidade: integer('quantidade').notNull(),
    motivo: text('motivo', { enum: MOTIVOS_VASILHAME }).notNull(),
    origem: text('origem', { enum: ORIGENS_VASILHAME }),
    origemId: uuid('origem_id'),
    /** Congelado no lancamento: relatorio de maio nao muda porque o galao encareceu em agosto. */
    custoUnitario: numeric('custo_unitario', { precision: 12, scale: 2 }).notNull().default('0'),
    usuarioId: uuid('usuario_id').references(() => users.id),
    observacao: text('observacao'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vasilhame_mov_company_idx').on(t.companyId, t.criadoEm),
    index('vasilhame_mov_cliente_idx').on(t.companyId, t.clienteId, t.criadoEm),
  ],
)

/**
 * Saldo por cliente — quem esta devendo galao.
 *
 * Mantido por trigger a partir dos movimentos. **Nunca escrever aqui pela
 * aplicacao:** lance o movimento e deixe o banco derivar, senao o saldo descola
 * do extrato que deveria explica-lo.
 */
export const vasilhameSaldos = pgTable(
  'vasilhame_saldos',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id),
    quantidade: integer('quantidade').notNull().default(0),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.clienteId, t.produtoId] }),
    index('vasilhame_saldos_company_idx').on(t.companyId, t.produtoId),
  ],
)

export type VasilhameMovimento = typeof vasilhameMovimentos.$inferSelect
export type NovoVasilhameMovimento = typeof vasilhameMovimentos.$inferInsert
export type VasilhameSaldo = typeof vasilhameSaldos.$inferSelect
