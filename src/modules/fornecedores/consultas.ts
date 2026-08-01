import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'
import { fornecedores } from '@/db/schema'
import { comTenant } from '@/lib/dal'

export interface FornecedorLista {
  id: string
  codigo: number | null
  nome: string
  documento: string | null
  telefone: string | null
  cidade: string | null
  uf: string | null
  ativo: boolean
}

export function listarFornecedores() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: fornecedores.id,
        codigo: fornecedores.codigo,
        nome: fornecedores.nome,
        documento: fornecedores.documento,
        telefone: fornecedores.telefone,
        cidade: fornecedores.cidade,
        uf: fornecedores.uf,
        ativo: fornecedores.ativo,
      })
      .from(fornecedores)
      .orderBy(asc(fornecedores.nome)),
  ) as Promise<FornecedorLista[]>
}

export function metricasFornecedores() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        comDocumento: sql<number>`count(*) filter (where ${fornecedores.documento} is not null)::int`,
        comTelefone: sql<number>`count(*) filter (where ${fornecedores.telefone} is not null)::int`,
        inativos: sql<number>`count(*) filter (where not ${fornecedores.ativo})::int`,
      })
      .from(fornecedores)

    return linha
  })
}

export function acharFornecedor(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx.select().from(fornecedores).where(eq(fornecedores.id, id)).limit(1)
    return linha ?? null
  })
}

export function acharFornecedorPorDocumento(documento: string, exceto?: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({ id: fornecedores.id, nome: fornecedores.nome, codigo: fornecedores.codigo })
      .from(fornecedores)
      .where(
        exceto
          ? and(eq(fornecedores.documento, documento), sql`${fornecedores.id} <> ${exceto}`)
          : eq(fornecedores.documento, documento),
      )
      .limit(1)
    return linha ?? null
  })
}
