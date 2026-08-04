import 'server-only'

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
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
      // Produto inativo some da lista de Saldo em Estoque — some do resumo
      // também, senão "Valor em estoque" contaria um produto que a tabela
      // abaixo não mostra mais.
      .where(and(eq(produtos.controlaEstoque, true), eq(produtos.ativo, true)))

    return linha
  }) as Promise<MetricasEstoque>
}

export interface MetricasPorTipo {
  quantidade: number
  abaixoDoMinimo: number
}

export interface MetricasEstoquePorTipo {
  agua: MetricasPorTipo
  vasilhame: MetricasPorTipo
  gas: MetricasPorTipo
}

/**
 * O mesmo cabeçalho, quebrado por água/vasilhame/gás — os três únicos tipos
 * que a distribuidora vende. "Abaixo do mínimo" somado por tudo dizia que
 * havia problema, nunca em quê: a operadora tinha que abrir a tabela inteira
 * para achar o produto. Aqui a pergunta "o que está faltando" já vem
 * respondida no card.
 *
 * A classificação é a mesma de `metricasProdutos()` (cadastro de produtos):
 * substring sobre `categoria`, texto livre. Não há um terceiro balde "outro"
 * porque a distribuidora não vende nada fora dessas três linhas — um produto
 * fora do padrão simplesmente não soma em nenhum card, e seguiria aparecendo
 * na tabela abaixo.
 */
export function metricasEstoquePorTipo() {
  const saldo = sql`coalesce(${estoqueSaldos.quantidade}, 0)`
  const abaixo = sql`${produtos.estoqueMinimo} > 0 and ${saldo} < ${produtos.estoqueMinimo}`
  const ehAgua = sql`(lower(${produtos.categoria}) like '%água%' or lower(${produtos.categoria}) like '%agua%')`
  const ehVasilhame = sql`(lower(${produtos.categoria}) like '%vasilhame%' or lower(${produtos.categoria}) like '%galao%' or lower(${produtos.categoria}) like '%galão%')`
  const ehGas = sql`(lower(${produtos.categoria}) like '%gás%' or lower(${produtos.categoria}) like '%gas%')`

  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        aguaQuantidade: sql<number>`coalesce(sum(${saldo}) filter (where ${ehAgua}), 0)::float8`,
        aguaAbaixo: sql<number>`count(*) filter (where ${ehAgua} and ${abaixo})::int`,
        vasilhameQuantidade: sql<number>`coalesce(sum(${saldo}) filter (where ${ehVasilhame}), 0)::float8`,
        vasilhameAbaixo: sql<number>`count(*) filter (where ${ehVasilhame} and ${abaixo})::int`,
        gasQuantidade: sql<number>`coalesce(sum(${saldo}) filter (where ${ehGas}), 0)::float8`,
        gasAbaixo: sql<number>`count(*) filter (where ${ehGas} and ${abaixo})::int`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      // Produto inativo não soma aqui: o card é "quanto tem pra vender", e um
      // produto inativo não é oferecido em lugar nenhum.
      .where(and(eq(produtos.controlaEstoque, true), eq(produtos.ativo, true)))

    return {
      agua: { quantidade: Number(linha.aguaQuantidade), abaixoDoMinimo: Number(linha.aguaAbaixo) },
      vasilhame: {
        quantidade: Number(linha.vasilhameQuantidade),
        abaixoDoMinimo: Number(linha.vasilhameAbaixo),
      },
      gas: { quantidade: Number(linha.gasQuantidade), abaixoDoMinimo: Number(linha.gasAbaixo) },
    }
  }) as Promise<MetricasEstoquePorTipo>
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
  /** Preenchido quando a operadora excluiu esta linha pela tela. */
  excluidoEm: Date | null
  excluidoPor: string | null
}

/**
 * O razão completo, em ordem cronológica invertida.
 *
 * Sem paginação no banco, pela mesma razão da listagem de vasilhame: a
 * `TabelaDados` já pagina, busca e ordena do lado do cliente. Quando passar de
 * alguns milhares de linhas, o lugar de mudar é aqui, sozinho.
 *
 * Linha excluída continua na lista — é o histórico da exclusão. Quem esconde
 * o detalhe financeiro dela é a tabela na tela, não esta consulta.
 */
export function listarMovimentos() {
  const estornado = sql<boolean>`exists (
    select 1 from estoque_movimentos e where e.estorno_de = ${estoqueMovimentos.id}
  )`
  const usuariosExclusao = alias(users, 'usuarios_exclusao')

  return comTenant(async (tx) => {
    const linhas = await tx
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
        adminId: estoqueMovimentos.adminId,
        estornoDe: estoqueMovimentos.estornoDe,
        estornado,
        excluidoEm: estoqueMovimentos.excluidoEm,
        excluidoPor: usuariosExclusao.nome,
        excluidoPorAdminId: estoqueMovimentos.excluidoPorAdminId,
      })
      .from(estoqueMovimentos)
      .innerJoin(produtos, eq(produtos.id, estoqueMovimentos.produtoId))
      .leftJoin(fornecedores, eq(fornecedores.id, estoqueMovimentos.fornecedorId))
      .leftJoin(users, eq(users.id, estoqueMovimentos.usuarioId))
      .leftJoin(usuariosExclusao, eq(usuariosExclusao.id, estoqueMovimentos.excluidoPor))
      .orderBy(desc(estoqueMovimentos.criadoEm), desc(estoqueMovimentos.id))

    /**
     * `usuario_id` fica nulo quando quem lançou foi suporte Aionix (sessão sem
     * linha em `users` — ver `autorDoLancamento`). `plataforma_admins` não tem
     * grant para `casco_app` (0008): a única leitura válida é a função
     * `admin_nomes`, em lote, para não fazer uma consulta por linha.
     */
    const idsAdmin = [
      ...new Set(
        linhas.flatMap((l) => [l.adminId, l.excluidoPorAdminId]).filter((id): id is string => !!id),
      ),
    ]
    const nomePorAdmin = new Map<string, string>()
    if (idsAdmin.length > 0) {
      const admins = await tx.execute<{ id: string; nome: string }>(
        sql`select id, nome from admin_nomes(${idsAdmin}::uuid[])`,
      )
      for (const a of admins) nomePorAdmin.set(a.id, a.nome)
    }

    return linhas.map((l) => ({
      ...l,
      usuario: l.usuario ?? (l.adminId ? (nomePorAdmin.get(l.adminId) ?? null) : null),
      excluidoPor:
        l.excluidoPor ??
        (l.excluidoPorAdminId ? (nomePorAdmin.get(l.excluidoPorAdminId) ?? null) : null),
    }))
  }) as Promise<MovimentoLista[]>
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
  entradasAguaMes: number
  entradasVasilhameMes: number
  entradasGasMes: number
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
 *
 * "Entrou no mês" é o único quebrado por tipo (água/vasilhame/gás): é o número
 * que a operadora confere contra a nota de compra ou a produção do dia, e
 * somado por tudo ele não diz se faltou entrada de um dos três. Saída, perda e
 * valor comprado continuam agregados — mistura pouco ali, porque saída é sobre
 * o caixa fechar, não sobre qual produto se moveu.
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

  // Mesma classificação por substring de `metricasProdutos()`/`metricasEstoquePorTipo()`.
  const ehAgua = sql`(lower(${produtos.categoria}) like '%água%' or lower(${produtos.categoria}) like '%agua%')`
  const ehVasilhame = sql`(lower(${produtos.categoria}) like '%vasilhame%' or lower(${produtos.categoria}) like '%galao%' or lower(${produtos.categoria}) like '%galão%')`
  const ehGas = sql`(lower(${produtos.categoria}) like '%gás%' or lower(${produtos.categoria}) like '%gas%')`

  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        entradasAguaMes: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade})
          filter (where ${estoqueMovimentos.quantidade} > 0 and ${doMes} and ${ehAgua}), 0)::float8`,
        entradasVasilhameMes: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade})
          filter (where ${estoqueMovimentos.quantidade} > 0 and ${doMes} and ${ehVasilhame}), 0)::float8`,
        entradasGasMes: sql<number>`coalesce(sum(${estoqueMovimentos.quantidade})
          filter (where ${estoqueMovimentos.quantidade} > 0 and ${doMes} and ${ehGas}), 0)::float8`,
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
      .innerJoin(produtos, eq(produtos.id, estoqueMovimentos.produtoId))
      // Excluído não é lançamento válido — não deveria mover nenhum destes
      // números, mesmo tendo movido o saldo antes de ser excluído.
      .where(isNull(estoqueMovimentos.excluidoEm))

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
