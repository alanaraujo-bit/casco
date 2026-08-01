import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { tabelasPreco, precos, produtos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

export interface TabelaPrecoLista {
  id: string
  nome: string
  padrao: boolean
  ativo: boolean
  totalProdutos: number
}

export function listarTabelas() {
  const total = sql<number>`coalesce((
    select count(*)::int
      from ${precos}
     where ${precos.tabelaId} = ${tabelasPreco.id}
  ), 0)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: tabelasPreco.id,
        nome: tabelasPreco.nome,
        padrao: tabelasPreco.padrao,
        ativo: tabelasPreco.ativo,
        totalProdutos: total,
      })
      .from(tabelasPreco)
      .orderBy(asc(tabelasPreco.nome)),
  ) as Promise<TabelaPrecoLista[]>
}

export function acharTabela(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx.select().from(tabelasPreco).where(eq(tabelasPreco.id, id)).limit(1)
    return linha ?? null
  })
}

export interface PrecoComProduto {
  produtoId: string
  produtoNome: string
  produtoCodigo: number | null
  precoPadrao: string
  preco: string | null
}

export function listarPrecosDaTabela(tabelaId: string) {
  return comTenant(async (tx) =>
    tx
      .select({
        produtoId: produtos.id,
        produtoNome: produtos.nome,
        produtoCodigo: produtos.codigo,
        precoPadrao: produtos.precoPadrao,
        preco: precos.preco,
      })
      .from(produtos)
      .leftJoin(
        precos,
        sql`${precos.produtoId} = ${produtos.id} and ${precos.tabelaId} = ${tabelaId}`,
      )
      .where(eq(produtos.ativo, true))
      .orderBy(asc(produtos.nome)),
  ) as Promise<PrecoComProduto[]>
}
