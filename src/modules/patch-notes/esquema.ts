import { CATEGORIAS_PATCH_NOTE, type CategoriaPatchNote } from '@/db/schema'

/**
 * O que a Central de Atualizações mostra e como rotula cada categoria.
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

export const ROTULO_CATEGORIA_PATCH_NOTE: Record<CategoriaPatchNote, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
  desempenho: 'Desempenho',
  seguranca: 'Segurança',
  interface: 'Interface',
}

export { CATEGORIAS_PATCH_NOTE }
