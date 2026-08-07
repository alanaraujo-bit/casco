import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import {
  clientes,
  contasBancarias,
  contasReceber,
  entregadores,
  estoqueSaldos,
  formasPagamento,
  pagamentos,
  precos,
  produtos,
  tabelasPreco,
  users,
  vasilhameMovimentos,
  vendaItens,
  vendas,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Leituras de Vendas.
 *
 * O PDV carrega tudo de uma vez, na abertura da tela: produtos, preços de
 * todas as tabelas, clientes e formas de pagamento. Parece muito — é pouco. Uma
 * distribuidora tem dezenas de produtos e três tabelas de preço, e o custo de
 * trazer isso junto é uma fração do custo de ir ao servidor a cada troca de
 * cliente. Recarregar a cada clique é o que faz um PDV parecer lento mesmo
 * com o banco respondendo rápido.
 */

/* ------------------------------------------------------------------ o PDV */

export interface ProdutoVenda {
  id: string
  codigo: number | null
  nome: string
  unidade: string
  precoPadrao: string
  icone: string | null
  /** Produto que gera comodato (Água 20L), não o vasilhame em si. */
  retornavel: boolean
  vasilhameId: string | null
  controlaEstoque: boolean
  /** Saldo atual. Não bloqueia a venda — informa. Ver a nota em `acoes.ts`. */
  emEstoque: number
}

export function listarProdutosParaVenda() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        unidade: produtos.unidade,
        precoPadrao: produtos.precoPadrao,
        icone: produtos.icone,
        retornavel: produtos.retornavel,
        vasilhameId: produtos.vasilhameId,
        controlaEstoque: produtos.controlaEstoque,
        emEstoque: sql<number>`coalesce(${estoqueSaldos.quantidade}, 0)::float8`,
      })
      .from(produtos)
      .leftJoin(estoqueSaldos, eq(estoqueSaldos.produtoId, produtos.id))
      .where(eq(produtos.ativo, true))
      .orderBy(asc(produtos.nome)),
  ) as Promise<ProdutoVenda[]>
}

export interface PrecoTabela {
  tabelaId: string
  produtoId: string
  preco: string
}

/** Todos os preços de todas as tabelas ativas. Ver a nota do topo do arquivo. */
export function listarPrecosDeVenda() {
  return comTenant(async (tx) =>
    tx
      .select({
        tabelaId: precos.tabelaId,
        produtoId: precos.produtoId,
        preco: precos.preco,
      })
      .from(precos)
      .innerJoin(tabelasPreco, eq(tabelasPreco.id, precos.tabelaId))
      .where(eq(tabelasPreco.ativo, true)),
  ) as Promise<PrecoTabela[]>
}

export interface ClienteVenda {
  id: string
  codigo: number | null
  nome: string
  /** Define a tabela de preço quando o cliente não tem uma escolhida à mão. */
  tabelaPrecoId: string | null
  /** Quantos galões ele já deve, somados. Aparece ao escolher o cliente. */
  vasilhameNaRua: number
  /** Quanto ele já tem em aberto em Contas a Receber. É a pergunta do a prazo. */
  emAberto: string
  limiteCredito: string
}

export function listarClientesParaVenda() {
  const naRua = sql<number>`coalesce((
    select sum(s.quantidade)::int
      from vasilhame_saldos s
     where s.cliente_id = ${clientes.id} and s.quantidade > 0
  ), 0)`

  const emAberto = sql<string>`coalesce((
    select sum(${contasReceber.valorParcela})
      from ${contasReceber}
     where ${contasReceber.clienteId} = ${clientes.id}
       and ${contasReceber.pagoEm} is null
  ), 0)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: clientes.id,
        codigo: clientes.codigo,
        nome: clientes.nome,
        tabelaPrecoId: clientes.tabelaPrecoId,
        vasilhameNaRua: naRua,
        emAberto,
        limiteCredito: clientes.limiteCredito,
      })
      .from(clientes)
      .where(eq(clientes.ativo, true))
      .orderBy(asc(clientes.nome)),
  ) as Promise<ClienteVenda[]>
}

export interface EntregadorVenda {
  id: string
  nome: string
}

export function listarEntregadoresParaVenda() {
  return comTenant(async (tx) =>
    tx
      .select({ id: entregadores.id, nome: entregadores.nome })
      .from(entregadores)
      .where(eq(entregadores.ativo, true))
      .orderBy(asc(entregadores.nome)),
  ) as Promise<EntregadorVenda[]>
}

/** A tabela usada quando o cliente não tem uma, e na venda avulsa de balcão. */
export function acharTabelaPadrao() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({ id: tabelasPreco.id })
      .from(tabelasPreco)
      .where(and(eq(tabelasPreco.padrao, true), eq(tabelasPreco.ativo, true)))
      .limit(1)
    return linha?.id ?? null
  })
}

/* ------------------------------------------------------------- a listagem */

/**
 * Colunas na ordem consagrada: Operação · Código · Data ·
 * Cliente · Entregador · Água · Vendedor · Comissão · Tipo Venda · Parcelas ·
 * Valor · Recebido · Taxas · A Receber.
 *
 * "Recebido" e "A Receber" são **derivados**, não campos: recebido é o que
 * entrou em `pagamentos`, a receber é o que sobrou em aberto em
 * `contas_receber`. Gravadas na venda, as duas colunas param de bater no dia
 * em que alguém baixa um título por fora.
 *
 * "Água" segue a mesma regra e é a soma das quantidades dos itens de produto
 * **retornável** — que é o que o cadastro chama de galão que gera comodato. Não
 * é uma coluna de `vendas`, e não deve ser: água vendida é a soma dos itens, e
 * congelá-la na venda faria a listagem discordar do item no dia em que um item
 * for corrigido.
 */
export interface VendaLista {
  id: string
  operacao: string
  codigo: number | null
  criadoEm: Date
  cliente: string
  entregador: string | null
  /** Galões de produto retornável nesta venda. Ver a nota acima. */
  agua: number
  /** Vasilhames vazios que o cliente entregou junto, somados. */
  devolvido: number
  vendedor: string | null
  comissao: string
  tipoVenda: string
  parcelas: number
  valor: string
  recebido: string
  taxas: string
  aReceber: string
  status: string
  itens: number
}

export function listarVendas(limite = 500) {
  const recebido = sql<string>`coalesce((
    select sum(p.valor) from pagamentos p where p.venda_id = ${vendas.id}
  ), 0)`

  const aReceber = sql<string>`coalesce((
    select sum(${contasReceber.valorParcela})
      from ${contasReceber}
     where ${contasReceber.vendaId} = ${vendas.id} and ${contasReceber.pagoEm} is null
  ), 0)`

  const tipoVenda = sql<string>`coalesce((
    select f.nome
      from pagamentos p join formas_pagamento f on f.id = p.forma_id
     where p.venda_id = ${vendas.id}
     order by p.recebido_em asc
     limit 1
  ), case when exists (
      select 1 from ${contasReceber}
       where ${contasReceber.vendaId} = ${vendas.id}
    ) then 'A Prazo' else '—' end)`

  const itens = sql<number>`coalesce((
    select count(*)::int from ${vendaItens} where ${vendaItens.vendaId} = ${vendas.id}
  ), 0)`

  const agua = sql<number>`coalesce((
    select sum(vi.quantidade)::float8
      from venda_itens vi
      join produtos p on p.id = vi.produto_id
     where vi.venda_id = ${vendas.id} and p.retornavel
  ), 0)`

  const devolvido = sql<number>`coalesce((
    select sum(${vendaItens.vasilhameDevolvido})::int
      from ${vendaItens} where ${vendaItens.vendaId} = ${vendas.id}
  ), 0)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: vendas.id,
        operacao: vendas.origem,
        codigo: vendas.codigo,
        criadoEm: vendas.criadoEm,
        // Venda avulsa não tem cliente, e isso não é dado faltando — é o caso
        // mais comum do balcão. A coluna diz o que aconteceu.
        cliente: sql<string>`coalesce(${clientes.nome}, 'Consumidor no balcão')`,
        entregador: entregadores.nome,
        agua,
        devolvido,
        vendedor: users.nome,
        comissao: vendas.comissao,
        tipoVenda,
        parcelas: vendas.parcelas,
        valor: vendas.total,
        recebido,
        taxas: vendas.taxas,
        aReceber,
        status: vendas.status,
        itens,
      })
      .from(vendas)
      .leftJoin(clientes, eq(clientes.id, vendas.clienteId))
      .leftJoin(users, eq(users.id, vendas.vendedorId))
      .leftJoin(entregadores, eq(entregadores.id, vendas.entregadorId))
      .orderBy(desc(vendas.criadoEm))
      .limit(limite),
  ) as Promise<VendaLista[]>
}

/**
 * Os cartões do cabeçalho, em uma consulta.
 *
 * "Hoje" é calculado no fuso da loja e não do servidor: na Vercel o servidor
 * roda em UTC, e uma venda das 21h de Tucumã cairia no dia seguinte — o
 * fechamento de caixa da operadora não fecharia com a tela, e ela teria razão.
 */
export function metricasVendas() {
  return comTenant(async (tx) => {
    const hoje = sql`(${vendas.criadoEm} at time zone 'America/Belem')::date
                     = (now() at time zone 'America/Belem')::date`
    const confirmada = sql`${vendas.status} = 'confirmada'`

    const [linha] = await tx
      .select({
        totalHoje: sql<string>`coalesce(sum(${vendas.total}) filter (where ${hoje} and ${confirmada}), 0)`,
        qtdHoje: sql<number>`count(*) filter (where ${hoje} and ${confirmada})::int`,
        totalMes: sql<string>`coalesce(sum(${vendas.total}) filter (
          where ${confirmada}
            and date_trunc('month', ${vendas.criadoEm} at time zone 'America/Belem')
              = date_trunc('month', now() at time zone 'America/Belem')
        ), 0)`,
        taxasMes: sql<string>`coalesce(sum(${vendas.taxas}) filter (
          where ${confirmada}
            and date_trunc('month', ${vendas.criadoEm} at time zone 'America/Belem')
              = date_trunc('month', now() at time zone 'America/Belem')
        ), 0)`,
        ticketMedio: sql<string>`coalesce(avg(${vendas.total}) filter (where ${confirmada}), 0)`,
        qtdTotal: sql<number>`count(*) filter (where ${confirmada})::int`,
      })
      .from(vendas)

    return linha
  })
}

/* ------------------------------------------------------------- o comprovante */

export interface ItemDaVenda {
  id: string
  produtoId: string
  produto: string
  codigo: number | null
  unidade: string
  icone: string | null
  retornavel: boolean
  quantidade: string
  precoUnitario: string
  total: string
  vasilhameDevolvido: number
}

export function itensDaVenda(vendaId: string) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: vendaItens.id,
        produtoId: vendaItens.produtoId,
        produto: produtos.nome,
        codigo: produtos.codigo,
        unidade: produtos.unidade,
        icone: produtos.icone,
        retornavel: produtos.retornavel,
        quantidade: vendaItens.quantidade,
        precoUnitario: vendaItens.precoUnitario,
        total: vendaItens.total,
        vasilhameDevolvido: vendaItens.vasilhameDevolvido,
      })
      .from(vendaItens)
      .innerJoin(produtos, eq(produtos.id, vendaItens.produtoId))
      .where(eq(vendaItens.vendaId, vendaId))
      .orderBy(asc(produtos.nome)),
  ) as Promise<ItemDaVenda[]>
}

/* ------------------------------------------------------------- o detalhe */

/**
 * Uma venda inteira, para a tela que se abre ao clicar na linha.
 *
 * A listagem responde "o que aconteceu hoje"; esta consulta responde "o que
 * aconteceu **nesta** venda" — que é a pergunta de quem foi conferir um número
 * que não bateu. Por isso ela traz os ids junto dos nomes: a tela precisa
 * apontar de volta para o cliente, para o título e para o produto, e um detalhe
 * que só mostra texto obriga a operadora a procurar tudo de novo no menu.
 */
export interface VendaDetalhe {
  id: string
  codigo: number | null
  operacao: string
  status: string
  criadoEm: Date
  clienteId: string | null
  cliente: string | null
  clienteTelefone: string | null
  vendedor: string | null
  entregadorId: string | null
  entregador: string | null
  /** `false` quando o entregador foi desativado depois da venda. */
  entregadorAtivo: boolean | null
  observacao: string | null
  subtotal: string
  desconto: string
  total: string
  taxas: string
  comissao: string
  parcelas: number
}

export function acharVenda(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: vendas.id,
        codigo: vendas.codigo,
        operacao: vendas.origem,
        status: vendas.status,
        criadoEm: vendas.criadoEm,
        clienteId: vendas.clienteId,
        cliente: clientes.nome,
        clienteTelefone: clientes.telefone,
        vendedor: users.nome,
        entregadorId: vendas.entregadorId,
        entregador: entregadores.nome,
        entregadorAtivo: entregadores.ativo,
        observacao: vendas.observacao,
        subtotal: vendas.subtotal,
        desconto: vendas.desconto,
        total: vendas.total,
        taxas: vendas.taxas,
        comissao: vendas.comissao,
        parcelas: vendas.parcelas,
      })
      .from(vendas)
      .leftJoin(clientes, eq(clientes.id, vendas.clienteId))
      .leftJoin(users, eq(users.id, vendas.vendedorId))
      .leftJoin(entregadores, eq(entregadores.id, vendas.entregadorId))
      .where(eq(vendas.id, id))
      .limit(1)

    // A RLS já garante que uma venda de outra distribuidora não é encontrada —
    // `null` aqui é o mesmo caminho para "não existe" e "não é sua".
    return (linha ?? null) as VendaDetalhe | null
  })
}

export interface PagamentoDaVenda {
  id: string
  forma: string | null
  conta: string | null
  valor: string
  taxa: string
  recebidoEm: Date
}

export function pagamentosDaVenda(vendaId: string) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: pagamentos.id,
        forma: formasPagamento.nome,
        conta: contasBancarias.nome,
        valor: pagamentos.valor,
        taxa: pagamentos.taxa,
        recebidoEm: pagamentos.recebidoEm,
      })
      .from(pagamentos)
      .leftJoin(formasPagamento, eq(formasPagamento.id, pagamentos.formaId))
      .leftJoin(contasBancarias, eq(contasBancarias.id, pagamentos.contaId))
      .where(eq(pagamentos.vendaId, vendaId))
      .orderBy(asc(pagamentos.recebidoEm)),
  ) as Promise<PagamentoDaVenda[]>
}

export interface TituloDaVenda {
  id: string
  codigo: number | null
  parcelaNumero: number
  parcelaTotal: number
  valorParcela: string
  vencimento: string
  pagoEm: string | null
  valorPago: string | null
}

export function titulosDaVenda(vendaId: string) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: contasReceber.id,
        codigo: contasReceber.codigo,
        parcelaNumero: contasReceber.parcelaNumero,
        parcelaTotal: contasReceber.parcelaTotal,
        valorParcela: contasReceber.valorParcela,
        vencimento: contasReceber.vencimento,
        pagoEm: contasReceber.pagoEm,
        valorPago: contasReceber.valorPago,
      })
      .from(contasReceber)
      .where(eq(contasReceber.vendaId, vendaId))
      .orderBy(asc(contasReceber.parcelaNumero)),
  ) as Promise<TituloDaVenda[]>
}

export interface VasilhameDaVenda {
  id: string
  produto: string
  motivo: string
  quantidade: number
}

/**
 * O comodato que esta venda movimentou.
 *
 * Fica na tela da venda por um motivo prático: quando o saldo de galões de um
 * cliente não bate, a conferência começa na venda que ele questiona — e ter que
 * abrir Movimentos e filtrar por data para descobrir o que ela gerou é o passo
 * em que a operadora desiste e liga para alguém.
 */
export function vasilhameDaVenda(vendaId: string) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: vasilhameMovimentos.id,
        produto: produtos.nome,
        motivo: vasilhameMovimentos.motivo,
        quantidade: vasilhameMovimentos.quantidade,
      })
      .from(vasilhameMovimentos)
      .innerJoin(produtos, eq(produtos.id, vasilhameMovimentos.produtoId))
      .where(
        and(
          eq(vasilhameMovimentos.origem, 'venda'),
          eq(vasilhameMovimentos.origemId, vendaId),
        ),
      )
      .orderBy(asc(vasilhameMovimentos.criadoEm)),
  ) as Promise<VasilhameDaVenda[]>
}
