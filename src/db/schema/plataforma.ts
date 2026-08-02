import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Administradores da Aionix — nós, não os clientes.
 *
 * Sem `company_id` de propósito: um admin não pertence a distribuidora nenhuma,
 * ele entra em uma. Ver o cabeçalho da migration `0008_admins_plataforma.sql`.
 *
 * O tipo está aqui pela tipagem; **as queries não usam esta tabela**. Ela tem
 * RLS sem política e nenhum grant para `casco_app` — um `select` do Drizzle
 * apontado para cá volta vazio. O acesso vai pelas funções `security definer`
 * declaradas na mesma migration.
 */
export const plataformaAdmins = pgTable('plataforma_admins', {
  id: uuid('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  senhaHash: text('senha_hash').notNull(),
  senhaProvisoria: boolean('senha_provisoria').notNull().default(true),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
})

export type PlataformaAdmin = typeof plataformaAdmins.$inferSelect

/**
 * Configuração da plataforma — hoje só o webhook de feedback do Discord.
 *
 * Mesma nota da tabela acima: o tipo é só para tipagem, **as queries não usam
 * esta tabela**. RLS sem política, sem grant, acesso só pelas funções
 * `security definer` da migration `0014_config_plataforma.sql`.
 */
export const plataformaConfig = pgTable('plataforma_config', {
  id: boolean('id').primaryKey().default(true),
  discordWebhookFeedback: text('discord_webhook_feedback'),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type PlataformaConfig = typeof plataformaConfig.$inferSelect
