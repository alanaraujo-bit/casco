import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { entregadores } from '@/db/schema'
import { comTenant } from '@/lib/dal'

export interface EntregadorLista {
  id: string
  codigo: number | null
  nome: string
  telefone: string | null
  ativo: boolean
}

export function listarEntregadores() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: entregadores.id,
        codigo: entregadores.codigo,
        nome: entregadores.nome,
        telefone: entregadores.telefone,
        ativo: entregadores.ativo,
      })
      .from(entregadores)
      .where(eq(entregadores.ativo, true))
      .orderBy(asc(entregadores.nome)),
  ) as Promise<EntregadorLista[]>
}

export function metricasEntregadores() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        comTelefone: sql<number>`count(*) filter (where ${entregadores.telefone} is not null)::int`,
        inativos: sql<number>`count(*) filter (where not ${entregadores.ativo})::int`,
      })
      .from(entregadores)

    return linha
  })
}

export function acharEntregador(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx.select().from(entregadores).where(eq(entregadores.id, id)).limit(1)
    return linha ?? null
  })
}
