import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { produtos, estoqueSaldos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

export interface ProdutoLista {
  id: string
  codigo: number | null
  nome: string
  sku: string | null
  categoria: string | null
  unidade: string
  precoPadrao: string
  custo: string
  retornavel: boolean
  controlaEstoque: boolean
  estoqueMinimo: string
  estoqueMaximo: string
  ncm: string | null
  ativo: boolean
  estoque: number
}

export function listarProdutos() {
  const saldo = sql<number>`coalesce((
    select ${estoqueSaldos.quantidade}::numeric
      from ${estoqueSaldos}
     where ${estoqueSaldos.produtoId} = ${produtos.id}
  ), 0)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        sku: produtos.sku,
        categoria: produtos.categoria,
        unidade: produtos.unidade,
        precoPadrao: produtos.precoPadrao,
        custo: produtos.custo,
        retornavel: produtos.retornavel,
        controlaEstoque: produtos.controlaEstoque,
        estoqueMinimo: produtos.estoqueMinimo,
        estoqueMaximo: produtos.estoqueMaximo,
        ncm: produtos.ncm,
        ativo: produtos.ativo,
        estoque: saldo,
      })
      .from(produtos)
      .orderBy(asc(produtos.nome)),
  ) as Promise<ProdutoLista[]>
}

export function metricasProdutos() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        ativos: sql<number>`count(*) filter (where ${produtos.ativo})::int`,
        retornaveis: sql<number>`count(*) filter (where ${produtos.retornavel})::int`,
        semPreco: sql<number>`count(*) filter (where ${produtos.precoPadrao} = 0)::int`,
      })
      .from(produtos)

    return linha
  })
}

export function acharProduto(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx.select().from(produtos).where(eq(produtos.id, id)).limit(1)
    return linha ?? null
  })
}

export function listarProdutosRetornaveis() {
  return comTenant((tx) =>
    tx
      .select({ id: produtos.id, nome: produtos.nome })
      .from(produtos)
      .where(eq(produtos.ativo, true))
      .orderBy(asc(produtos.nome)),
  )
}
