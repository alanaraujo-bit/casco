import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { exigirAdmin, exigirSessao } from '@/lib/dal'
import type { CategoriaPatchNote, StatusPatchNote } from '@/db/schema'
import type { PatchNoteAdmin, PatchNotePublicado } from './esquema'

/**
 * Leitura da Central de Atualizações.
 *
 * `patch_notes` não tem `company_id` — não é dado de uma distribuidora, é
 * conteúdo do produto. Por isso a consulta não passa por `comTenant()`
 * (não existe tenant para aplicar): o mesmo desenho já usado em
 * `src/modules/admin/consultas.ts`, trocando `exigirAdmin()` por
 * `exigirSessao()`, porque aqui quem lê é qualquer usuário logado, não só a
 * Aionix. `patch_notes_listar_publicados()` é `security definer` e devolve só
 * o que está publicado — rascunho nunca sai daqui.
 */

type LinhaPublicada = {
  id: string
  slug: string
  titulo: string
  resumo: string
  corpo: string
  categoria: CategoriaPatchNote
  publicado_em: Date
}

export async function listarPatchNotesPublicados(): Promise<PatchNotePublicado[]> {
  await exigirSessao()

  const linhas = await db.execute<LinhaPublicada>(
    sql`select * from patch_notes_listar_publicados()`,
  )

  return linhas.map((l) => ({
    id: l.id,
    slug: l.slug,
    titulo: l.titulo,
    resumo: l.resumo,
    corpo: l.corpo,
    categoria: l.categoria,
    publicadoEm: l.publicado_em,
  }))
}

// ------------------------------------------------------------------ admin

type LinhaAdmin = {
  id: string
  slug: string
  titulo: string
  resumo: string
  corpo: string
  categoria: CategoriaPatchNote
  status: StatusPatchNote
  commits_origem: string[]
  publicado_em: Date | null
  atualizado_em: Date
}

function paraPatchNoteAdmin(l: LinhaAdmin): PatchNoteAdmin {
  return {
    id: l.id,
    slug: l.slug,
    titulo: l.titulo,
    resumo: l.resumo,
    corpo: l.corpo,
    categoria: l.categoria,
    status: l.status,
    commitsOrigem: l.commits_origem ?? [],
    publicadoEm: l.publicado_em,
    atualizadoEm: l.atualizado_em,
  }
}

/** Fila de admin: tudo, rascunho incluído — `patch_notes_admin_listar()` ignora status. */
export async function listarPatchNotesAdmin(): Promise<PatchNoteAdmin[]> {
  await exigirAdmin()

  const linhas = await db.execute<LinhaAdmin>(sql`select * from patch_notes_admin_listar()`)
  return linhas.map(paraPatchNoteAdmin)
}

export async function buscarPatchNoteAdmin(id: string): Promise<PatchNoteAdmin | null> {
  await exigirAdmin()

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null

  const linhas = await db.execute<LinhaAdmin>(
    sql`select * from patch_notes_admin_listar() where id = ${id}`,
  )
  const linha = linhas[0]
  return linha ? paraPatchNoteAdmin(linha) : null
}
