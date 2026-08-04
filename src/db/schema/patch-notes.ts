import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies, users } from './tenancy'
import { plataformaAdmins } from './plataforma'

/**
 * Espelho tipado de `migrations/0015_patch_notes.sql`.
 *
 * `patchNotes` é conteúdo do produto, não de uma distribuidora: sem
 * `company_id`, de propósito, mesma razão de `plataformaAdmins`. O tipo está
 * aqui só pela tipagem — **as queries não usam esta tabela direto**, RLS sem
 * política e sem grant fecham a porta para `casco_app`; o acesso vai pelas
 * funções `security definer` da migration.
 *
 * `patchNotesReacoes` e `patchNotesLeituras` são por-tenant normais — quem
 * curtiu e quem já viu é dado de uma empresa, e essas duas seguem via Drizzle
 * comum dentro de `comTenant()`.
 */

export const CATEGORIAS_PATCH_NOTE = [
  'novo',
  'melhoria',
  'correcao',
  'desempenho',
  'seguranca',
  'interface',
] as const
export type CategoriaPatchNote = (typeof CATEGORIAS_PATCH_NOTE)[number]

export const STATUS_PATCH_NOTE = ['rascunho', 'publicado', 'arquivado'] as const
export type StatusPatchNote = (typeof STATUS_PATCH_NOTE)[number]

export const TIPOS_REACAO_PATCH_NOTE = ['like', 'dislike'] as const
export type TipoReacaoPatchNote = (typeof TIPOS_REACAO_PATCH_NOTE)[number]

export const patchNotes = pgTable('patch_notes', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull(),
  titulo: text('titulo').notNull(),
  resumo: text('resumo').notNull(),
  corpo: text('corpo').notNull(),
  categoria: text('categoria', { enum: CATEGORIAS_PATCH_NOTE }).notNull(),
  status: text('status', { enum: STATUS_PATCH_NOTE }).notNull().default('rascunho'),
  commitsOrigem: text('commits_origem').array().notNull().default([]),
  publicadoEm: timestamp('publicado_em', { withTimezone: true }),
  criadoPor: uuid('criado_por').references(() => plataformaAdmins.id),
  aprovadoPor: uuid('aprovado_por').references(() => plataformaAdmins.id),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type PatchNote = typeof patchNotes.$inferSelect

export const patchNotesReacoes = pgTable('patch_notes_reacoes', {
  id: uuid('id').primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  patchNoteId: uuid('patch_note_id')
    .notNull()
    .references(() => patchNotes.id),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => users.id),
  tipo: text('tipo', { enum: TIPOS_REACAO_PATCH_NOTE }).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type PatchNoteReacao = typeof patchNotesReacoes.$inferSelect

export const patchNotesLeituras = pgTable('patch_notes_leituras', {
  id: uuid('id').primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  patchNoteId: uuid('patch_note_id')
    .notNull()
    .references(() => patchNotes.id),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => users.id),
  lidoEm: timestamp('lido_em', { withTimezone: true }).notNull().defaultNow(),
})

export type PatchNoteLeitura = typeof patchNotesLeituras.$inferSelect
