import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Empresas (tenants). Cada distribuidora que usa o Casco e uma linha aqui.
 */
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey(),
  nome: text('nome').notNull(),
  documento: text('documento'),
  telefone: text('telefone'),
  plano: text('plano').notNull().default('basico'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Usuarios. `papel` e propositalmente grosseiro: distribuidora pequena nao tem
 * organograma, e permissao granular vira tela de configuracao que ninguem usa.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    senhaHash: text('senha_hash').notNull(),
    papel: text('papel', { enum: ['dono', 'operador', 'entregador'] }).notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_company_idx').on(t.companyId)],
)

export type Company = typeof companies.$inferSelect
export type User = typeof users.$inferSelect
export type Papel = User['papel']
