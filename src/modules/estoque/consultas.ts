import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import {
  estoqueMovimentos,
  estoqueSaldos,
  fornecedores,
  produtos,
  users,
  type TipoEstoque,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Leitura do estoque.
 *
 * A listagem sai de `produtos` com left join em `estoque_saldos`, e não o
 * contrário: produto que nunca teve movimento não tem linha de saldo, e é
 * justamente ele que a operadora precisa ver — é o que ainda não foi contado.
 * Partir de `estoque_saldos` esconderia todo produto zerado.
 */

export interface SaldoLista {
  id: string
  codigo: number | null
  nome: string
  /** No lugar do "Complemento" da tela deles; é o campo mais próximo que temos. */
  sku: string | null
  categoria: string | null
  unidade: string
  quantidade: number
  custoMedio: number
  precoPadrao: number
  estoqueMinimo: number
  estoqueMaximo: number
  ncm: string | null
  controlaEstoque: boolean
  ativo: boolean
  /** `quantidade × custoMedio`. O que está parado no depósito, em reais. */
  valorEmEstoque: number
}

/** Só os produtos que controlam estoque interessam aqui — serviço não tem saldo. */
export function listarSaldos() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        sku: produtos.sku,
        categoria: produtos.categoria,
        unidade: produtos.unidade,
        quantidade: sql<number>`coalesce(${estoqueSaldos.quantidade}, 0)::float8`,
        custoMedio: sql<number>`coalesce(${estoqueSaldos.custoMedio}, 0)::float8`,
        precoPadrao: sql<number>`${produtos.precoPadrao}::float8`,
        estoqueMinimo: sql<number>`${produtos.estoqueMinimo}::float8`,
        estoqueMaximo: sql<number>`${produtos.estoqueMaximo}::float8`,
        ncm: produtos.ncm,
        controlaEstoque: produtos.controlaEstoque,
        ativo: produtos.ativo,
        valorEmEstoque: sql<number>`(coalesce(${estoqueSaldos.quantidade}, 0)
                                     * coalesce(${estoqueSaldos.custoMedio}, 0))::float8`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      .where(eq(produtos.controlaEstoque, true))
      .orderBy(asc(produtos.nome)),
  ) as Promise<SaldoLista[]>
}

export interface MetricasEstoque {
  itens: number
  abaixoDoMinimo: number
  semEstoque: number
  valorTotal: number
}

/**
 * O cabeçalho da tela, em uma query.
 *
 * "Abaixo do mínimo" só conta quem tem mínimo configurado: `estoque_minimo`
 * nasce em zero, e contar `saldo <= 0` como alerta faria a tela abrir com todos
 * os produtos em vermelho no primeiro dia — o alarme que toca sempre é o alarme
 * que a operadora aprende a ignorar.
 */
export function metricasEstoque() {
  const saldo = sql`coalesce(${estoqueSaldos.quantidade}, 0)`

  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        itens: sql<number>`count(*)::int`,
        abaixoDoMinimo: sql<number>`count(*) filter (
          where ${produtos.estoqueMinimo} > 0 and ${saldo} < ${produtos.estoqueMinimo}
        )::int`,
        semEstoque: sql<number>`count(*) filter (where ${saldo} <= 0)::int`,
        valorTotal: sql<number>`coalesce(sum(
          greatest(${saldo}, 0) * coalesce(${estoqueSaldos.custoMedio}, 0)
        ), 0)::float8`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      .where(eq(produtos.controlaEstoque, true))

    return linha
  }) as Promise<MetricasEstoque>
}

/* ------------------------------------------------------------- movimentos */

export interface MovimentoLista {
  id: string
  criadoEm: Date
  tipo: TipoEstoque
  produto: string
  produtoId: string
  unidade: string
  quantidade: number
  custoUnitario: number
  /** `quantidade × custo`, sempre positivo. O que a linha moveu, em reais. */
  valor: number
  fornecedor: string | null
  documento: string | null
  observacao: string | null
  usuario: string | null
  estornoDe: string | null
  estornado: boolean
}

/**
 * O razão completo, em ordem cronológica invertida.
 *
 * Sem paginação no banco, pela mesma razão da listagem de vasilhame: a
 * `TabelaDados` já pagina, busca e ordena do lado do cliente. Quando passar de
 * alguns milhares de linhas, o lugar de mudar é aqui, sozinho.
 */
export function listarMovimentos() {
  const estornado = sql<boolean>`exists (
    select 1 from estoque_movimentos e where e.estorno_de = ${estoqueMovimentos.id}
  )`

  return comTenant((tx) =>
    tx
      .select({
        id: estoqueMovimentos.id,
        criadoEm: estoqueMovimentos.criadoEm,
        tipo: estoqueMovimentos.tipo,
        produto: produtos.nome,
        produtoId: estoqueMovimentos.produtoId,
        unidade: produtos.unidade,
        quantidade: sql<number>`${estoqueMovimentos.quantidade}::float8`,
        custoUnitario: sql<number>`${estoqueMovimentos.custoUnitario}::float8`,
        valor: sql<number>`abs(${estoqueMovimentos.quantidade} * ${estoqueMovimentos.custoUnitario})::float8`,
        fornecedor: fornecedores.nome,
        documento: estoqueMovimentos.documento,
        observacao: estoqueMovimentos.observacao,
        usuario: users.nome,
        estornoDe: estoqueMovimentos.estornoDe,
        estornado,
      })
      .from(estoqueMovimentos)
      .innerJoin(produtos, eq(produtos.id, estoqueMovimentos.produtoId))
      .leftJoin(fornecedores, eq(fornecedores.id, estoqueMovimentos.fornecedorId))
      .leftJoin(users, eq(users.id, estoqueMovimentos.usuarioId))
      .orderBy(desc(estoqueMovimentos.criadoEm), desc(estoqueMovimentos.id)),
  ) as Promise<MovimentoLista[]>
}

/* --------------------------------------------------- listas do formulário */

export interface ProdutoParaMovimento {
  id: string
  nome: string
  unidade: string
  /** Saldo atual, para a operadora conferir antes de lançar. */
  saldo: number
  /**
   * O que sugerir no campo de custo: o custo médio se já houve entrada, o custo
   * do cadastro enquanto não houve. Sugerir zero na primeira entrada faria a
   * operadora confirmar zero — e o custo médio nasceria errado para sempre.
   */
  custoSugerido: number
}

export function listarProdutosParaMovimento() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: produtos.id,
        nome: produtos.nome,
        unidade: produtos.unidade,
        saldo: sql<number>`coalesce(${estoqueSaldos.quantidade}, 0)::float8`,
        custoSugerido: sql<number>`(case
          when coalesce(${estoqueSaldos.custoMedio}, 0) > 0 then ${estoqueSaldos.custoMedio}
          else ${produtos.custo}
        end)::float8`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      .where(and(eq(produtos.ativo, true), eq(produtos.controlaEstoque, true)))
      .orderBy(asc(produtos.nome)),
  ) as Promise<ProdutoParaMovimento[]>
}

export interface MetricasMovimentos {
  entradasMes: number
  saidasMes: number
  perdaMes: number
  valorEntradasMes: number
}

/**
 * O cabeçalho da tela de movimentos, no mês corrente.
 *
 * O mês é o da loja, não o do servidor: `date_trunc` sobre `criado_em` em UTC
 * jogaria os lançamentos das últimas três horas de cada mês para o mês seguinte
 * — e o fechamento nunca bateria, sem ninguém entender por quê.
 */
export function metricasMovimentos() {
  const doMes = sql`date_trunc('month', ${estoqueMovimentos.criadoEm} at time zone 'America/Belem')
                    = date_trunc('month', now() at time zone 'America/Belem')`

  // Mesma regra da view `estoque_perdas`: estorno não é perda, e linha
  // estornada deixou de ser. Se a tela contasse os dois, o número que a
  // operadora vê já nasceria brigando com o DRE.
  const perdaValida = sql`${estoqueMovimentos.tipo} = 'perda'
    and ${estoqueMovimentos.estornoDe} is null
    and not exists (
      select 1 from estoque_movimentos e where e.estorno_de = ${estoqueMovimentos.id}
    )`

  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        entradasMes: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade})
          filter (where ${estoqueMovimentos.quantidade} > 0 and ${doMes}), 0)::float8`,
        saidasMes: sql<number>`coalesce(-sum(${estoqueMovimentos.quantidade})
          filter (where ${estoqueMovimentos.quantidade} < 0 and ${doMes}), 0)::float8`,
        perdaMes: sql<number>`coalesce(sum(
          -${estoqueMovimentos.quantidade} * ${estoqueMovimentos.custoUnitario}
        ) filter (where ${perdaValida} and ${doMes}), 0)::float8`,
        valorEntradasMes: sql<number>`coalesce(sum(
          ${estoqueMovimentos.quantidade} * ${estoqueMovimentos.custoUnitario}
        ) filter (where ${estoqueMovimentos.quantidade} > 0 and ${doMes}), 0)::float8`,
      })
      .from(estoqueMovimentos)

    return linha
  }) as Promise<MetricasMovimentos>
}

/* ---------------------------------------------------------------- extrato */

export interface LinhaExtrato {
  id: string
  criadoEm: Date
  tipo: TipoEstoque
  quantidade: number
  /** Saldo do produto **depois** deste movimento. */
  saldoApos: number
  custoUnitario: number
  fornecedor: string | null
  documento: string | null
  observacao: string | null
  usuario: string | null
  origem: string | null
  /** Preenchido quando esta linha desfaz outra. Vira selo "estorno". */
  estornoDe: string | null
  /** Esta linha já foi desfeita por outra. */
  estornado: boolean
}

/**
 * O extrato que responde "por que o saldo deste produto é 143?".
 *
 * O saldo corrente sai de uma função de janela e não de um laço no JavaScript:
 * somar em memória obrigaria a trazer o histórico inteiro para calcular a
 * última linha, e a conta pararia de fechar no dia em que a tela ganhasse
 * paginação.
 *
 * O estorno soma normalmente no saldo corrente — é assim que ele desfaz de
 * verdade. O que ele não faz é sumir com a linha original: as duas ficam à
 * vista, e é isso que permite conferir a correção em vez de ter que confiar
 * nela.
 */
export function extratoProduto(produtoId: string) {
  const saldoApos = sql<number>`(sum(${estoqueMovimentos.quantidade}) over (
    order by ${estoqueMovimentos.criadoEm}, ${estoqueMovimentos.id}
  ))::float8`

  const estornado = sql<boolean>`exists (
    select 1 from estoque_movimentos e where e.estorno_de = ${estoqueMovimentos.id}
  )`

  return comTenant((tx) =>
    tx
      .select({
        id: estoqueMovimentos.id,
        criadoEm: estoqueMovimentos.criadoEm,
        tipo: estoqueMovimentos.tipo,
        quantidade: sql<number>`${estoqueMovimentos.quantidade}::float8`,
        saldoApos,
        custoUnitario: sql<number>`${estoqueMovimentos.custoUnitario}::float8`,
        fornecedor: fornecedores.nome,
        documento: estoqueMovimentos.documento,
        observacao: estoqueMovimentos.observacao,
        usuario: users.nome,
        origem: estoqueMovimentos.origem,
        estornoDe: estoqueMovimentos.estornoDe,
        estornado,
      })
      .from(estoqueMovimentos)
      .leftJoin(fornecedores, eq(fornecedores.id, estoqueMovimentos.fornecedorId))
      .leftJoin(users, eq(users.id, estoqueMovimentos.usuarioId))
      .where(eq(estoqueMovimentos.produtoId, produtoId))
      .orderBy(desc(estoqueMovimentos.criadoEm), desc(estoqueMovimentos.id)),
  ) as Promise<LinhaExtrato[]>
}

/** Cabeçalho da página de extrato: qual produto é, e onde o saldo dele está. */
export function acharSaldoProduto(produtoId: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        unidade: produtos.unidade,
        ativo: produtos.ativo,
        controlaEstoque: produtos.controlaEstoque,
        quantidade: sql<number>`coalesce(${estoqueSaldos.quantidade}, 0)::float8`,
        custoMedio: sql<number>`coalesce(${estoqueSaldos.custoMedio}, 0)::float8`,
        estoqueMinimo: sql<number>`${produtos.estoqueMinimo}::float8`,
        estoqueMaximo: sql<number>`${produtos.estoqueMaximo}::float8`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      .where(eq(produtos.id, produtoId))
      .limit(1)

    return linha ?? null
  })
}
