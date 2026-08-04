import { z } from 'zod'
import type { Falha } from '@/lib/erros'
import { CATEGORIAS_PATCH_NOTE, STATUS_PATCH_NOTE, type CategoriaPatchNote, type StatusPatchNote } from '@/db/schema'

/**
 * O que a Central de Atualizações mostra e como rotula cada categoria/status.
 */

export type PatchNotePublicado = {
  id: string
  slug: string
  titulo: string
  resumo: string
  corpo: string
  categoria: CategoriaPatchNote
  publicadoEm: Date
}

export type PatchNoteAdmin = {
  id: string
  slug: string
  titulo: string
  resumo: string
  corpo: string
  categoria: CategoriaPatchNote
  status: StatusPatchNote
  commitsOrigem: string[]
  publicadoEm: Date | null
  atualizadoEm: Date
}

export const ROTULO_CATEGORIA_PATCH_NOTE: Record<CategoriaPatchNote, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
  desempenho: 'Desempenho',
  seguranca: 'Segurança',
  interface: 'Interface',
}

export const ROTULO_STATUS_PATCH_NOTE: Record<StatusPatchNote, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
}

export { CATEGORIAS_PATCH_NOTE, STATUS_PATCH_NOTE }

// ------------------------------------------------------------------ formulário

export const esquemaPatchNoteAdmin = z.object({
  titulo: z.string().trim().min(4, 'Escreva um título curto').max(120, 'Máximo de 120 caracteres'),
  resumo: z.string().trim().min(4, 'Escreva um resumo de uma frase').max(200, 'Máximo de 200 caracteres'),
  corpo: z.string().trim().min(10, 'Descreva a novidade com um pouco mais de detalhe'),
  categoria: z.enum(CATEGORIAS_PATCH_NOTE, { message: 'Escolha a categoria' }),
  commitsOrigem: z
    .string()
    .trim()
    .transform((v) => (v ? v.split(/[\s,]+/).filter(Boolean) : [])),
})

export type PatchNoteValidado = z.output<typeof esquemaPatchNoteAdmin>

export const CAMPOS_PATCH_NOTE_ADMIN = [
  'titulo',
  'resumo',
  'corpo',
  'categoria',
  'commitsOrigem',
] as const

export type CampoPatchNoteAdmin = (typeof CAMPOS_PATCH_NOTE_ADMIN)[number]

export interface EstadoFormularioPatchNoteAdmin {
  erro?: Falha | string
  campos?: Partial<Record<CampoPatchNoteAdmin, string>>
  valores?: Partial<Record<CampoPatchNoteAdmin, string>>
  tentativa?: number
  sucesso?: boolean
  /** Preenchido só na criação, para o formulário redirecionar para a edição. */
  idCriado?: string
}

/**
 * `título-em-minúsculo-sem-acento` + sufixo curto. O admin não digita slug —
 * um campo a mais que só existe para virar URL não vale a fricção, e "Venda
 * ganha cupom" e "venda-ganha-cupom" nunca vão divergir se um deles não é
 * digitado.
 */
export function gerarSlugPatchNote(titulo: string, sufixo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base}-${sufixo}`
}
