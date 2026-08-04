import 'server-only'

import { inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { comTenant, exigirAdmin, exigirSessao } from '@/lib/dal'
import { patchNotesReacoes, type CategoriaPatchNote, type StatusPatchNote, type TipoReacaoPatchNote } from '@/db/schema'
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

/**
 * Quantas novidades publicadas este usuário ainda não viu — o número do sino
 * na sidebar. `patch_notes_contar_nao_lidos()` cruza a tabela global com
 * `patch_notes_leituras` (por-tenant); por rodar como dono do banco, o filtro
 * de empresa e usuário é passado explícito, não deduzido de RLS.
 *
 * Admin da Aionix dentro de uma empresa não tem linha em `users`, então nunca
 * marca nada como lido — o contador ficaria sempre no total de publicados
 * para ele. Sem prejuízo real: é suporte de passagem, não quem acompanha a
 * Central no dia a dia.
 */
export async function contarPatchNotesNaoLidos(): Promise<number> {
  const sessao = await exigirSessao()
  if (sessao.adminId) return 0

  const [linha] = await db.execute<{ patch_notes_contar_nao_lidos: number }>(
    sql`select patch_notes_contar_nao_lidos(${sessao.companyId}, ${sessao.usuarioId})`,
  )
  return Number(linha?.patch_notes_contar_nao_lidos ?? 0)
}

// --------------------------------------------------------------- reações

export type ContagemReacaoPatchNote = { likes: number; dislikes: number; minha: TipoReacaoPatchNote | null }

/**
 * Curtidas e não-curtidas de quem está na mesma empresa — `patch_notes_reacoes`
 * é por-tenant, então a contagem é a da distribuidora, não do Casco inteiro.
 * `comTenant()` de verdade aqui: ao contrário da leitura de `patch_notes`, esta
 * tabela tem RLS normal e é dado de negócio como outro qualquer.
 */
export async function listarReacoesPatchNotes(
  patchNoteIds: string[],
): Promise<Record<string, ContagemReacaoPatchNote>> {
  if (patchNoteIds.length === 0) return {}

  return comTenant(async (tx, sessao) => {
    const linhas = await tx
      .select({
        patchNoteId: patchNotesReacoes.patchNoteId,
        tipo: patchNotesReacoes.tipo,
        usuarioId: patchNotesReacoes.usuarioId,
      })
      .from(patchNotesReacoes)
      .where(inArray(patchNotesReacoes.patchNoteId, patchNoteIds))

    const porNota: Record<string, ContagemReacaoPatchNote> = {}
    for (const id of patchNoteIds) porNota[id] = { likes: 0, dislikes: 0, minha: null }

    for (const l of linhas) {
      const c = porNota[l.patchNoteId]
      if (l.tipo === 'like') c.likes++
      else c.dislikes++
      if (l.usuarioId === sessao.usuarioId) c.minha = l.tipo
    }
    return porNota
  })
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
