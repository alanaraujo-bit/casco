import 'server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { produtos, estoqueSaldos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Só ativos: produto excluído (inativado pela lixeira da lista) some daqui.
 * Reativar é decisão da ficha (`/cadastro/produtos/[id]`), que continua
 * acessível por link direto mesmo sem o produto aparecer nesta lista.
 */

export interface ProdutoLista {
  id: string
  codigo: number | null
  nome: string
  sku: string | null
  categoria: string | null
  icone: string | null
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

/**
 * `incluirInativos` existe só para o filtro "Mostrar inativos" da lista — é a
 * única forma de achar e reativar um produto, já que a lista some com ele por
 * padrão (ver a nota em `botao-excluir-cadastro.tsx`).
 */
export function listarProdutos(opcoes: { incluirInativos?: boolean } = {}) {
  const saldo = sql<number>`coalesce((
    select ${estoqueSaldos.quantidade}::numeric
      from ${estoqueSaldos}
     where ${estoqueSaldos.produtoId} = ${produtos.id}
  ), 0)`

  return comTenant(async (tx) => {
    const query = tx
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        sku: produtos.sku,
        categoria: produtos.categoria,
        icone: produtos.icone,
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
      .orderBy(asc(produtos.nome))

    return opcoes.incluirInativos ? query : query.where(eq(produtos.ativo, true))
  }) as Promise<ProdutoLista[]>
}

export function metricasProdutos() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        total: sql<number>`count(distinct ${produtos.id})::int`,
        aguas: sql<number>`coalesce(sum(${estoqueSaldos.quantidade}) filter (where lower(${produtos.categoria}) like '%água%' or lower(${produtos.categoria}) like '%agua%'), 0)::int`,
        vasilhames: sql<number>`coalesce(sum(${estoqueSaldos.quantidade}) filter (where lower(${produtos.categoria}) like '%galao%' or lower(${produtos.categoria}) like '%galão%' or lower(${produtos.categoria}) like '%vasilhame%'), 0)::int`,
        gas: sql<number>`coalesce(sum(${estoqueSaldos.quantidade}) filter (where lower(${produtos.categoria}) like '%gás%' or lower(${produtos.categoria}) like '%gas%'), 0)::int`,
        semPreco: sql<number>`count(distinct ${produtos.id}) filter (where ${produtos.precoPadrao} = 0)::int`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      // Produto inativo some da lista (ver listarProdutos) — some daqui também,
      // senão o card mostraria estoque de um produto que a tela não exibe mais.
      .where(eq(produtos.ativo, true))

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

/**
 * As categorias que já estão em uso, para o seletor do formulário.
 *
 * Sai de `distinct` sobre a coluna, e não de uma tabela de categorias: uma
 * tabela exigiria uma tela de manutenção, um cadastro a mais para a operadora
 * lembrar de preencher antes do primeiro produto, e uma decisão sobre o que
 * fazer com a categoria que ficou órfã. O `distinct` responde a mesma pergunta
 * — "o que já foi usado aqui?" — sem nenhuma dessas três coisas.
 *
 * Produto inativo continua contando: a categoria dele existe, e some da lista
 * exatamente quando o último produto que a usava for renomeado.
 */
export function listarCategoriasProduto() {
  return comTenant(async (tx) => {
    const linhas = await tx
      .selectDistinct({ categoria: produtos.categoria })
      .from(produtos)
      .where(sql`${produtos.categoria} is not null and btrim(${produtos.categoria}) <> ''`)
      .orderBy(asc(produtos.categoria))
    return linhas.map((l) => l.categoria as string)
  })
}
