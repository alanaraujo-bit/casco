'use server'

import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { db } from '@/db/client'
import { comTenant, exigirAdmin } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { patchNotesReacoes, TIPOS_REACAO_PATCH_NOTE, type StatusPatchNote, type TipoReacaoPatchNote } from '@/db/schema'
import {
  CAMPOS_PATCH_NOTE_ADMIN,
  esquemaPatchNoteAdmin,
  gerarSlugPatchNote,
  type CampoPatchNoteAdmin,
  type EstadoFormularioPatchNoteAdmin,
} from './esquema'

/**
 * CRUD e fluxo de status da Central de Atualizações.
 *
 * `patch_notes` é global — nada aqui passa por `comTenant()`, e sim por
 * `exigirAdmin()` direto, como `src/modules/admin/acoes.ts` já faz para o que
 * não é dado de uma distribuidora.
 */

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_PATCH_NOTE_ADMIN.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoPatchNoteAdmin, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoPatchNoteAdmin, string>,
  tentativa: number,
): EstadoFormularioPatchNoteAdmin {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoPatchNoteAdmin, string>> = {}
  for (const campo of CAMPOS_PATCH_NOTE_ADMIN) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

export async function criarPatchNoteRascunho(
  anterior: EstadoFormularioPatchNoteAdmin,
  form: FormData,
): Promise<EstadoFormularioPatchNoteAdmin> {
  const admin = await exigirAdmin()
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaPatchNoteAdmin.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  try {
    const id = randomUUID()
    const slug = gerarSlugPatchNote(dados.titulo, id.slice(0, 8))

    await db.execute(sql`
      select patch_notes_admin_criar(
        ${id}, ${slug}, ${dados.titulo}, ${dados.resumo}, ${dados.corpo},
        ${dados.categoria}, ${dados.commitsOrigem}, ${admin.adminId}
      )
    `)

    revalidatePath('/admin/patch-notes')
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }

  redirect('/admin/patch-notes')
}

export async function atualizarPatchNote(
  id: string,
  anterior: EstadoFormularioPatchNoteAdmin,
  form: FormData,
): Promise<EstadoFormularioPatchNoteAdmin> {
  await exigirAdmin()
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaPatchNoteAdmin.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  try {
    const [resultado] = await db.execute<{ patch_notes_admin_atualizar: boolean }>(sql`
      select patch_notes_admin_atualizar(
        ${id}, ${dados.titulo}, ${dados.resumo}, ${dados.corpo}, ${dados.categoria}, ${dados.commitsOrigem}
      )
    `)

    if (!resultado?.patch_notes_admin_atualizar) {
      return { erro: 'Essa novidade não existe mais.', valores, tentativa }
    }

    revalidatePath('/admin/patch-notes')
    revalidatePath(`/admin/patch-notes/${id}`)
    revalidatePath('/atualizacoes')

    return { tentativa, sucesso: true, valores }
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/**
 * `rascunho -> publicado` e `publicado -> arquivado` são as transições que a
 * fila de admin oferece. A regra de "o que pode virar o quê" mora aqui, não
 * na função do banco — ela só grava o que mandarem (ver a migration 0015).
 */
const TRANSICOES_VALIDAS: Record<StatusPatchNote, StatusPatchNote[]> = {
  rascunho: ['publicado'],
  publicado: ['arquivado'],
  arquivado: [],
}

export async function mudarStatusPatchNote(form: FormData): Promise<void> {
  const admin = await exigirAdmin()

  const id = String(form.get('id') ?? '')
  const statusAtual = String(form.get('statusAtual') ?? '') as StatusPatchNote
  const statusAlvo = String(form.get('statusAlvo') ?? '') as StatusPatchNote

  if (!TRANSICOES_VALIDAS[statusAtual]?.includes(statusAlvo)) return

  await db.execute(sql`select patch_notes_admin_mudar_status(${id}, ${statusAlvo}, ${admin.adminId})`)

  revalidatePath('/admin/patch-notes')
  revalidatePath('/atualizacoes')
}

// ------------------------------------------------------------------ reações

/**
 * Curtir/não curtir alterna: clicar de novo no mesmo botão remove a reação.
 * Um único server action para os dois botões — o `tipo` vem do formulário —
 * porque "curtir" e "não curtir" são a mesma operação com sinal trocado, e
 * duas actions quase idênticas envelheceriam separadas (mesmo raciocínio de
 * `alternarAcesso` em `src/modules/admin/acoes.ts`).
 */
export async function alternarReacaoPatchNote(form: FormData): Promise<void> {
  const patchNoteId = String(form.get('patchNoteId') ?? '')
  const tipo = String(form.get('tipo') ?? '') as TipoReacaoPatchNote
  if (!(TIPOS_REACAO_PATCH_NOTE as readonly string[]).includes(tipo)) return

  await comTenant(async (tx, sessao) => {
    // `usuario_id` aqui é `not null` e aponta para `users`, ao contrário de
    // `feedbacks.usuario_id`. Um admin da Aionix dentro de uma empresa não
    // tem linha em `users` (ver `autorDoLancamento` em `src/lib/sessao.ts`) —
    // e não faria sentido ele curtir em nome da distribuidora mesmo que
    // tivesse. Sem reação, silenciosamente: não é erro, é "não se aplica".
    if (sessao.adminId) return

    const [existente] = await tx
      .select({ id: patchNotesReacoes.id, tipo: patchNotesReacoes.tipo })
      .from(patchNotesReacoes)
      .where(
        and(
          eq(patchNotesReacoes.patchNoteId, patchNoteId),
          eq(patchNotesReacoes.usuarioId, sessao.usuarioId),
        ),
      )

    if (existente?.tipo === tipo) {
      await tx.delete(patchNotesReacoes).where(eq(patchNotesReacoes.id, existente.id))
      return
    }

    if (existente) {
      await tx.update(patchNotesReacoes).set({ tipo }).where(eq(patchNotesReacoes.id, existente.id))
      return
    }

    await tx.insert(patchNotesReacoes).values({
      id: uuidv7(),
      companyId: sessao.companyId,
      patchNoteId,
      usuarioId: sessao.usuarioId,
      tipo,
    })
  })

  revalidatePath('/atualizacoes')
}
