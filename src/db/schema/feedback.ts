import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies, users } from './tenancy'

/**
 * Espelho tipado de `migrations/0013_feedbacks.sql`.
 */

export const TIPOS_FEEDBACK = ['bug', 'melhoria', 'sugestao'] as const
export type TipoFeedback = (typeof TIPOS_FEEDBACK)[number]

export const PRIORIDADES_FEEDBACK = ['baixa', 'media', 'alta', 'critica'] as const
export type PrioridadeFeedback = (typeof PRIORIDADES_FEEDBACK)[number]

export const STATUS_FEEDBACK = ['novo', 'visto', 'em_andamento', 'resolvido'] as const
export type StatusFeedback = (typeof STATUS_FEEDBACK)[number]

export const feedbacks = pgTable(
  'feedbacks',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    usuarioId: uuid('usuario_id').references(() => users.id),

    tipo: text('tipo', { enum: TIPOS_FEEDBACK }).notNull(),
    prioridade: text('prioridade', { enum: PRIORIDADES_FEEDBACK }),

    titulo: text('titulo').notNull(),
    descricao: text('descricao').notNull(),
    rota: text('rota'),
    codigoErro: text('codigo_erro'),

    status: text('status', { enum: STATUS_FEEDBACK }).notNull().default('novo'),
    avisado: boolean('avisado').notNull().default(false),

    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feedbacks_company_idx').on(t.companyId, t.criadoEm)],
)

export type Feedback = typeof feedbacks.$inferSelect
export type NovoFeedback = typeof feedbacks.$inferInsert
