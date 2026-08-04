import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { exigirSessao } from '@/lib/dal'
import type { CategoriaPatchNote } from '@/db/schema'
import type { PatchNotePublicado } from './esquema'

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
