import 'server-only'

import { asc, desc, eq, sql } from 'drizzle-orm'
import {
  caixaAberturas,
  caixaMovimentos,
  clientes,
  contasBancarias,
  contasPagar,
  contasReceber,
  formasPagamento,
  fornecedores,
  users,
  type TipoPagamento,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import type { Mes } from '@/modules/relatorios/periodo'

/**
 * `undefined` é "todo o período" — nenhum filtro. Um `Mes` (`YYYY-MM`) escopa
 * pelo mês do **vencimento**, o mesmo campo que já decide a situação: é a
 * pergunta natural de um contas a pagar/receber, "o que vence em agosto?",
 * e não "o que foi lançado em agosto?" nem "o que foi pago em agosto?".
 */
function filtroMes(coluna: typeof contasPagar.vencimento | typeof contasReceber.vencimento, mes?: Mes) {
  return mes ? sql`date_trunc('month', ${coluna}) = to_date(${mes} || '-01', 'YYYY-MM-DD')` : sql`true`
}

/**
 * Leituras de Contas a Receber.
 *
 * A situação (`Recebido` · `Em aberto` · `Vencido`) é **derivada** de `pago_em`
 * e `vencimento`, nunca de um campo digitado. Guardar a situação como dado
 * produz linha marcada "Vencido" com vencimento no mês que vem — erro que só
 * existe porque alguém gravou o que era consequência.
 */

export type SituacaoTitulo = 'Recebido' | 'Em aberto' | 'Vencido'

export interface TituloLista {
  id: string
  origem: string
  codigo: number | null
  cliente: string
  emissao: string
  valorTotal: string
  parcela: string
  valorParcela: string
  vencimento: string
  situacao: SituacaoTitulo
  banco: string | null
  formaPagamento: string | null
  taxas: string
  dataPagamento: string | null
  valorPago: string | null
}

const SITUACAO = sql<SituacaoTitulo>`
  case
    when ${contasReceber.pagoEm} is not null then 'Recebido'
    when ${contasReceber.vencimento} < current_date then 'Vencido'
    else 'Em aberto'
  end
`

/**
 * Colunas na ordem consagrada: Origem · Código ·
 * Cliente/Descrição · Emissão · Valor Total · Parcela · Valor Parcela ·
 * Vencimento · Recebido? · Banco · Forma Pgto · Taxas · Data Pgto · Valor Pago.
 */
export function listarContasReceber(mes?: Mes) {
  return comTenant((tx) =>
    tx
      .select({
        id: contasReceber.id,
        origem: contasReceber.origem,
        codigo: contasReceber.codigo,
        // Título avulso não tem cliente; a descrição ocupa o lugar. É a mesma
        // coluna "Cliente / Descrição" da listagem.
        cliente: sql<string>`coalesce(${clientes.nome}, ${contasReceber.descricao}, '—')`,
        emissao: sql<string>`to_char(${contasReceber.emissao}, 'DD/MM/YYYY')`,
        valorTotal: contasReceber.valorTotal,
        parcela: sql<string>`${contasReceber.parcelaNumero} || '/' || ${contasReceber.parcelaTotal}`,
        valorParcela: contasReceber.valorParcela,
        vencimento: sql<string>`to_char(${contasReceber.vencimento}, 'DD/MM/YYYY')`,
        situacao: SITUACAO,
        banco: contasBancarias.nome,
        formaPagamento: formasPagamento.nome,
        taxas: contasReceber.taxas,
        dataPagamento: sql<string | null>`to_char(${contasReceber.pagoEm}, 'DD/MM/YYYY')`,
        valorPago: contasReceber.valorPago,
      })
      .from(contasReceber)
      .leftJoin(clientes, sql`${clientes.id} = ${contasReceber.clienteId}`)
      .leftJoin(contasBancarias, sql`${contasBancarias.id} = ${contasReceber.contaId}`)
      .leftJoin(formasPagamento, sql`${formasPagamento.id} = ${contasReceber.formaId}`)
      .where(filtroMes(contasReceber.vencimento, mes))
      .orderBy(asc(contasReceber.vencimento)),
  ) as Promise<TituloLista[]>
}

/**
 * Os três cartões do cabeçalho, em **uma** consulta: **A Vencer** · **Vencido**
 * · **Recebido**. Mutuamente exclusivos, na mesma conta que decide a coluna
 * Situação — um título nunca aparece em dois cartões ao mesmo tempo, e a soma
 * dos três bate com o total do período.
 *
 * Somam por PARCELA e não pelo valor total do título: um título de R$ 1.200 em
 * 3× tem R$ 400 vencendo agora, e é isso que o dono precisa ver. Somar o total
 * inflaria "a receber" em três vezes — e ele soma de cabeça, então acha o erro.
 */
export function metricasReceber(mes?: Mes) {
  return comTenant(async (tx) => {
    const doMes = filtroMes(contasReceber.vencimento, mes)
    const recebido = sql`${contasReceber.pagoEm} is not null`
    const vencido = sql`${contasReceber.pagoEm} is null and ${contasReceber.vencimento} < current_date`
    const aVencer = sql`${contasReceber.pagoEm} is null and ${contasReceber.vencimento} >= current_date`

    const [linha] = await tx
      .select({
        aVencer: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${aVencer}), 0)`,
        qtdAVencer: sql<number>`count(*) filter (where ${aVencer})::int`,
        vencido: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${vencido}), 0)`,
        qtdVencido: sql<number>`count(*) filter (where ${vencido})::int`,
        recebido: sql<string>`coalesce(sum(${contasReceber.valorPago}) filter (where ${recebido}), 0)`,
        qtdRecebido: sql<number>`count(*) filter (where ${recebido})::int`,
      })
      .from(contasReceber)
      .where(doMes)

    return linha
  })
}

/* ------------------------------------------------------ meios de recebimento
 *
 * Moram aqui, e não no módulo de vendas, porque conta e forma de pagamento são
 * cadastro financeiro: o PDV é um dos consumidores, a baixa de título é outro,
 * e Contas a Pagar será o terceiro. Deixá-los em `vendas` faria o financeiro
 * depender de venda para saber onde o dinheiro cai.
 */

export interface FormaPagamentoOpcao {
  id: string
  nome: string
  tipo: TipoPagamento
  taxaPercentual: string
  prazoDias: number
}

export function listarFormasPagamento() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: formasPagamento.id,
        nome: formasPagamento.nome,
        tipo: formasPagamento.tipo,
        taxaPercentual: formasPagamento.taxaPercentual,
        prazoDias: formasPagamento.prazoDias,
      })
      .from(formasPagamento)
      .where(eq(formasPagamento.ativo, true))
      .orderBy(asc(formasPagamento.nome)),
  ) as Promise<FormaPagamentoOpcao[]>
}

export interface ContaOpcao {
  id: string
  nome: string
  tipo: string
}

export function listarContas() {
  return comTenant(async (tx) =>
    tx
      .select({ id: contasBancarias.id, nome: contasBancarias.nome, tipo: contasBancarias.tipo })
      .from(contasBancarias)
      .where(eq(contasBancarias.ativo, true))
      .orderBy(asc(contasBancarias.nome)),
  ) as Promise<ContaOpcao[]>
}

/* --------------------------------------------------------- um título só */

export interface TituloParaBaixa {
  id: string
  codigo: number | null
  cliente: string
  descricao: string | null
  emissao: string
  vencimento: string
  valorParcela: string
  parcela: string
  pagoEm: string | null
  valorPago: string | null
  taxas: string
  conta: string | null
  forma: string | null
}

export function acharTitulo(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: contasReceber.id,
        codigo: contasReceber.codigo,
        cliente: sql<string>`coalesce(${clientes.nome}, ${contasReceber.descricao}, '—')`,
        descricao: contasReceber.descricao,
        emissao: sql<string>`to_char(${contasReceber.emissao}, 'DD/MM/YYYY')`,
        vencimento: sql<string>`to_char(${contasReceber.vencimento}, 'DD/MM/YYYY')`,
        valorParcela: contasReceber.valorParcela,
        parcela: sql<string>`${contasReceber.parcelaNumero} || '/' || ${contasReceber.parcelaTotal}`,
        pagoEm: sql<string | null>`to_char(${contasReceber.pagoEm}, 'DD/MM/YYYY')`,
        valorPago: contasReceber.valorPago,
        taxas: contasReceber.taxas,
        conta: contasBancarias.nome,
        forma: formasPagamento.nome,
      })
      .from(contasReceber)
      .leftJoin(clientes, sql`${clientes.id} = ${contasReceber.clienteId}`)
      .leftJoin(contasBancarias, sql`${contasBancarias.id} = ${contasReceber.contaId}`)
      .leftJoin(formasPagamento, sql`${formasPagamento.id} = ${contasReceber.formaId}`)
      .where(eq(contasReceber.id, id))
      .limit(1)
    return (linha ?? null) as TituloParaBaixa | null
  })
}

/* ------------------------------------------------------------------- caixa
 *
 * **Só dinheiro que entrou ou saiu de fato.** É o que separa esta tela do DRE,
 * e a ausência mais importante aqui é a perda de vasilhame: vasilhame quebrado é
 * custo, mas nenhum real sai do caixa quando ele quebra. A perda vive em
 * `vasilhame_perdas` e aparece no resultado, nunca aqui.
 */

export interface MovimentoCaixa {
  id: string
  data: string
  conta: string
  sentido: 'entrada' | 'saida'
  categoria: string | null
  descricao: string | null
  valor: string
  usuario: string | null
}

export function listarCaixa(limite = 500) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: caixaMovimentos.id,
        data: sql<string>`to_char(${caixaMovimentos.data}, 'DD/MM/YYYY')`,
        conta: contasBancarias.nome,
        sentido: caixaMovimentos.sentido,
        categoria: caixaMovimentos.categoria,
        descricao: caixaMovimentos.descricao,
        valor: caixaMovimentos.valor,
        usuario: users.nome,
      })
      .from(caixaMovimentos)
      .innerJoin(contasBancarias, eq(contasBancarias.id, caixaMovimentos.contaId))
      .leftJoin(users, eq(users.id, caixaMovimentos.usuarioId))
      .orderBy(desc(caixaMovimentos.data), desc(caixaMovimentos.criadoEm))
      .limit(limite),
  ) as Promise<MovimentoCaixa[]>
}

/**
 * Saldo de cada conta: o saldo inicial mais tudo que entrou, menos tudo que saiu.
 *
 * Somado no banco a cada leitura, e não guardado numa coluna. Saldo guardado é
 * saldo que descola do extrato no primeiro lançamento que falhar pela metade —
 * e aí ninguém sabe qual dos dois números está certo. São dezenas de linhas por
 * mês; a soma é barata e é sempre explicável pelo que a lista mostra.
 */
export interface SaldoConta {
  id: string
  nome: string
  tipo: string
  saldo: string
  entradasMes: string
  saidasMes: string
}

export function saldosPorConta() {
  const doMes = sql`date_trunc('month', ${caixaMovimentos.data})
                    = date_trunc('month', (now() at time zone 'America/Belem')::date)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: contasBancarias.id,
        nome: contasBancarias.nome,
        tipo: contasBancarias.tipo,
        saldo: sql<string>`${contasBancarias.saldoInicial} + coalesce(sum(
          case when ${caixaMovimentos.sentido} = 'entrada'
               then ${caixaMovimentos.valor} else -${caixaMovimentos.valor} end
        ), 0)`,
        entradasMes: sql<string>`coalesce(sum(${caixaMovimentos.valor})
          filter (where ${caixaMovimentos.sentido} = 'entrada' and ${doMes}), 0)`,
        saidasMes: sql<string>`coalesce(sum(${caixaMovimentos.valor})
          filter (where ${caixaMovimentos.sentido} = 'saida' and ${doMes}), 0)`,
      })
      .from(contasBancarias)
      .leftJoin(caixaMovimentos, eq(caixaMovimentos.contaId, contasBancarias.id))
      .where(eq(contasBancarias.ativo, true))
      .groupBy(contasBancarias.id, contasBancarias.nome, contasBancarias.tipo, contasBancarias.saldoInicial)
      .orderBy(asc(contasBancarias.nome)),
  ) as Promise<SaldoConta[]>
}

/** O fechamento do dia, que é a pergunta das 18h: quanto entrou, quanto saiu. */
export function metricasCaixa() {
  return comTenant(async (tx) => {
    const hoje = sql`${caixaMovimentos.data} = (now() at time zone 'America/Belem')::date`
    const entrada = sql`${caixaMovimentos.sentido} = 'entrada'`

    const [linha] = await tx
      .select({
        entradasHoje: sql<string>`coalesce(sum(${caixaMovimentos.valor}) filter (where ${hoje} and ${entrada}), 0)`,
        saidasHoje: sql<string>`coalesce(sum(${caixaMovimentos.valor}) filter (where ${hoje} and not ${entrada}), 0)`,
        qtdHoje: sql<number>`count(*) filter (where ${hoje})::int`,
        movimentos: sql<number>`count(*)::int`,
      })
      .from(caixaMovimentos)

    return linha
  })
}

/* -------------------------------------------------------- abertura de caixa */

export interface ContaCaixaOpcao {
  id: string
  nome: string
}

/** Só as contas do tipo `caixa` — abertura é sobre a gaveta, não sobre banco. */
export function listarContasCaixa() {
  return comTenant(async (tx) =>
    tx
      .select({ id: contasBancarias.id, nome: contasBancarias.nome })
      .from(contasBancarias)
      .where(sql`${contasBancarias.ativo} and ${contasBancarias.tipo} = 'caixa'`)
      .orderBy(asc(contasBancarias.nome)),
  ) as Promise<ContaCaixaOpcao[]>
}

export interface CaixaAbertoHoje {
  aberturaId: string
  contaId: string
  contaNome: string
  valorAbertura: string
  fundoTroco: string
  usuario: string | null
  abertaEm: Date
}

/**
 * A abertura de caixa de hoje, se existir — a mais recente, quando mais de
 * uma operadora abriu turno na mesma conta no mesmo dia.
 *
 * "Hoje" é o dia **na loja** (`America/Belem`), não em UTC: sem isso, uma
 * abertura feita às 21h de Tucumã contaria como "de amanhã" no servidor e o
 * PDV pediria abertura de novo a cada venda depois daquele horário.
 */
export function caixaAbertoHoje() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        aberturaId: caixaAberturas.id,
        contaId: caixaAberturas.contaId,
        contaNome: contasBancarias.nome,
        valorAbertura: caixaAberturas.valorAbertura,
        fundoTroco: caixaAberturas.fundoTroco,
        usuario: users.nome,
        abertaEm: caixaAberturas.abertaEm,
      })
      .from(caixaAberturas)
      .innerJoin(contasBancarias, eq(contasBancarias.id, caixaAberturas.contaId))
      .leftJoin(users, eq(users.id, caixaAberturas.usuarioId))
      .where(
        sql`(${caixaAberturas.abertaEm} at time zone 'America/Belem')::date
            = (now() at time zone 'America/Belem')::date`,
      )
      .orderBy(desc(caixaAberturas.abertaEm))
      .limit(1)
    return (linha ?? null) as CaixaAbertoHoje | null
  })
}

export interface AberturaCaixaLista {
  id: string
  conta: string
  valorAbertura: string
  fundoTroco: string
  observacao: string | null
  usuario: string | null
  abertaEm: Date
}

export function listarAberturasCaixa(limite = 30) {
  return comTenant(async (tx) =>
    tx
      .select({
        id: caixaAberturas.id,
        conta: contasBancarias.nome,
        valorAbertura: caixaAberturas.valorAbertura,
        fundoTroco: caixaAberturas.fundoTroco,
        observacao: caixaAberturas.observacao,
        usuario: users.nome,
        abertaEm: caixaAberturas.abertaEm,
      })
      .from(caixaAberturas)
      .innerJoin(contasBancarias, eq(contasBancarias.id, caixaAberturas.contaId))
      .leftJoin(users, eq(users.id, caixaAberturas.usuarioId))
      .orderBy(desc(caixaAberturas.abertaEm))
      .limit(limite),
  ) as Promise<AberturaCaixaLista[]>
}

/* --------------------------------------------------------- contas a pagar
 *
 * Colunas na ordem consagrada: Parcela · Descrição ·
 * Despesa/Custos · Categoria · Tipo · Vencimento · Valor Previsto · Data
 * Pagamento · Valor Pagamento · Status · Forma Pagamento · Saída Dinheiro ·
 * Observação.
 *
 * "Despesa/Custos" é a coluna que o DRE precisa: custo entra no CMV, despesa
 * entra em despesa operacional. Aqui ela é
 * `natureza`, escolhida no lançamento e nunca deduzida do texto da descrição.
 */

export type SituacaoConta = 'Pago' | 'Em aberto' | 'Vencido'

export interface ContaPagarLista {
  id: string
  codigo: number | null
  descricao: string
  fornecedor: string | null
  natureza: string
  categoria: string | null
  parcela: string
  vencimento: string
  valorPrevisto: string
  pagoEm: string | null
  valorPago: string | null
  situacao: SituacaoConta
  forma: string | null
  conta: string | null
  observacao: string | null
}

const SITUACAO_PAGAR = sql<SituacaoConta>`
  case
    when ${contasPagar.pagoEm} is not null then 'Pago'
    when ${contasPagar.vencimento} < (now() at time zone 'America/Belem')::date then 'Vencido'
    else 'Em aberto'
  end
`

export function listarContasPagar(mes?: Mes) {
  return comTenant((tx) =>
    tx
      .select({
        id: contasPagar.id,
        codigo: contasPagar.codigo,
        descricao: contasPagar.descricao,
        fornecedor: fornecedores.nome,
        natureza: contasPagar.natureza,
        categoria: contasPagar.categoria,
        parcela: sql<string>`${contasPagar.parcelaNumero} || '/' || ${contasPagar.parcelaTotal}`,
        vencimento: sql<string>`to_char(${contasPagar.vencimento}, 'DD/MM/YYYY')`,
        valorPrevisto: contasPagar.valorPrevisto,
        pagoEm: sql<string | null>`to_char(${contasPagar.pagoEm}, 'DD/MM/YYYY')`,
        valorPago: contasPagar.valorPago,
        situacao: SITUACAO_PAGAR,
        forma: formasPagamento.nome,
        conta: contasBancarias.nome,
        observacao: contasPagar.observacao,
      })
      .from(contasPagar)
      .leftJoin(fornecedores, eq(fornecedores.id, contasPagar.fornecedorId))
      .leftJoin(formasPagamento, eq(formasPagamento.id, contasPagar.formaId))
      .leftJoin(contasBancarias, eq(contasBancarias.id, contasPagar.contaId))
      .where(filtroMes(contasPagar.vencimento, mes))
      .orderBy(asc(contasPagar.vencimento)),
  ) as Promise<ContaPagarLista[]>
}

/**
 * Os três cartões do cabeçalho, em uma consulta: **A Vencer** · **Vencido** ·
 * **Pago**. Mutuamente exclusivos, na mesma conta que decide a coluna Status
 * — a soma dos três bate com o total do período, sem contar nada duas vezes.
 */
export function metricasPagar(mes?: Mes) {
  return comTenant(async (tx) => {
    const doMes = filtroMes(contasPagar.vencimento, mes)
    const hoje = sql`(now() at time zone 'America/Belem')::date`
    const pago = sql`${contasPagar.pagoEm} is not null`
    const vencido = sql`${contasPagar.pagoEm} is null and ${contasPagar.vencimento} < ${hoje}`
    const aVencer = sql`${contasPagar.pagoEm} is null and ${contasPagar.vencimento} >= ${hoje}`

    const [linha] = await tx
      .select({
        aVencer: sql<string>`coalesce(sum(${contasPagar.valorPrevisto}) filter (where ${aVencer}), 0)`,
        qtdAVencer: sql<number>`count(*) filter (where ${aVencer})::int`,
        vencido: sql<string>`coalesce(sum(${contasPagar.valorPrevisto}) filter (where ${vencido}), 0)`,
        qtdVencido: sql<number>`count(*) filter (where ${vencido})::int`,
        pago: sql<string>`coalesce(sum(${contasPagar.valorPago}) filter (where ${pago}), 0)`,
        qtdPago: sql<number>`count(*) filter (where ${pago})::int`,
      })
      .from(contasPagar)
      .where(doMes)

    return linha
  })
}

export interface ContaPagarDetalhe {
  id: string
  codigo: number | null
  descricao: string
  fornecedor: string | null
  natureza: string
  categoria: string | null
  parcela: string
  emissao: string
  vencimento: string
  valorPrevisto: string
  pagoEm: string | null
  valorPago: string | null
  forma: string | null
  conta: string | null
  observacao: string | null
}

export function acharContaPagar(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: contasPagar.id,
        codigo: contasPagar.codigo,
        descricao: contasPagar.descricao,
        fornecedor: fornecedores.nome,
        natureza: contasPagar.natureza,
        categoria: contasPagar.categoria,
        parcela: sql<string>`${contasPagar.parcelaNumero} || '/' || ${contasPagar.parcelaTotal}`,
        emissao: sql<string>`to_char(${contasPagar.emissao}, 'DD/MM/YYYY')`,
        vencimento: sql<string>`to_char(${contasPagar.vencimento}, 'DD/MM/YYYY')`,
        valorPrevisto: contasPagar.valorPrevisto,
        pagoEm: sql<string | null>`to_char(${contasPagar.pagoEm}, 'DD/MM/YYYY')`,
        valorPago: contasPagar.valorPago,
        forma: formasPagamento.nome,
        conta: contasBancarias.nome,
        observacao: contasPagar.observacao,
      })
      .from(contasPagar)
      .leftJoin(fornecedores, eq(fornecedores.id, contasPagar.fornecedorId))
      .leftJoin(formasPagamento, eq(formasPagamento.id, contasPagar.formaId))
      .leftJoin(contasBancarias, eq(contasBancarias.id, contasPagar.contaId))
      .where(eq(contasPagar.id, id))
      .limit(1)
    return (linha ?? null) as ContaPagarDetalhe | null
  })
}

/* ------------------------------- cadastro de contas e formas de pagamento
 *
 * As listagens acima (`listarContas`, `listarFormasPagamento`) devolvem só o
 * que está ativo, porque servem de opção em combo — oferecer uma conta
 * desativada para receber um título seria oferecer um caminho que não deveria
 * existir. As duas daqui trazem **tudo**, porque a tela de cadastro precisa
 * mostrar o que foi desativado para poder reativar.
 */

export interface ContaCadastro {
  id: string
  nome: string
  tipo: string
  saldoInicial: string
  ativo: boolean
  /** Quantas formas de pagamento caem nesta conta. Desativar uma conta em uso
      deixaria essas formas sem destino, e a tela avisa antes. */
  formas: number
  /** Movimentos já lançados. Zero significa que ela nunca foi usada. */
  movimentos: number
}

export function listarContasCadastro() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: contasBancarias.id,
        nome: contasBancarias.nome,
        tipo: contasBancarias.tipo,
        saldoInicial: contasBancarias.saldoInicial,
        ativo: contasBancarias.ativo,
        formas: sql<number>`(
          select count(*)::int from formas_pagamento f where f.conta_id = ${contasBancarias.id}
        )`,
        movimentos: sql<number>`(
          select count(*)::int from caixa_movimentos m where m.conta_id = ${contasBancarias.id}
        )`,
      })
      .from(contasBancarias)
      .orderBy(desc(contasBancarias.ativo), asc(contasBancarias.nome)),
  ) as Promise<ContaCadastro[]>
}

export function acharConta(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: contasBancarias.id,
        nome: contasBancarias.nome,
        tipo: contasBancarias.tipo,
        saldoInicial: contasBancarias.saldoInicial,
        ativo: contasBancarias.ativo,
      })
      .from(contasBancarias)
      .where(eq(contasBancarias.id, id))
      .limit(1)
    return linha ?? null
  })
}

export interface FormaCadastro {
  id: string
  nome: string
  tipo: TipoPagamento
  taxaPercentual: string
  prazoDias: number
  conta: string | null
  contaId: string | null
  ativo: boolean
  /** Vendas já fechadas com esta forma. Impede a exclusão silenciosa do
      histórico — desativar é a única saída, e é a certa. */
  usos: number
}

export function listarFormasCadastro() {
  return comTenant(async (tx) =>
    tx
      .select({
        id: formasPagamento.id,
        nome: formasPagamento.nome,
        tipo: formasPagamento.tipo,
        taxaPercentual: formasPagamento.taxaPercentual,
        prazoDias: formasPagamento.prazoDias,
        conta: contasBancarias.nome,
        contaId: formasPagamento.contaId,
        ativo: formasPagamento.ativo,
        usos: sql<number>`(
          select count(*)::int from pagamentos p where p.forma_id = ${formasPagamento.id}
        )`,
      })
      .from(formasPagamento)
      .leftJoin(contasBancarias, eq(contasBancarias.id, formasPagamento.contaId))
      .orderBy(desc(formasPagamento.ativo), asc(formasPagamento.nome)),
  ) as Promise<FormaCadastro[]>
}

export function acharForma(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        id: formasPagamento.id,
        nome: formasPagamento.nome,
        tipo: formasPagamento.tipo,
        taxaPercentual: formasPagamento.taxaPercentual,
        prazoDias: formasPagamento.prazoDias,
        contaId: formasPagamento.contaId,
        ativo: formasPagamento.ativo,
      })
      .from(formasPagamento)
      .where(eq(formasPagamento.id, id))
      .limit(1)
    return linha ?? null
  })
}

export interface FornecedorOpcao {
  id: string
  codigo: number | null
  nome: string
}

export function listarFornecedoresAtivos() {
  return comTenant((tx) =>
    tx
      .select({ id: fornecedores.id, codigo: fornecedores.codigo, nome: fornecedores.nome })
      .from(fornecedores)
      .where(eq(fornecedores.ativo, true))
      .orderBy(asc(fornecedores.nome)),
  ) as Promise<FornecedorOpcao[]>
}

/**
 * As categorias de despesa já usadas, para o seletor do lançamento.
 *
 * Mesma escolha de `listarCategoriasProduto`: `distinct` sobre a coluna em vez
 * de tabela de cadastro. Aqui pesa ainda mais, porque é esta coluna que abre a
 * linha de despesa do DRE — cinco grafias de "Manutenção" viram cinco linhas
 * no relatório que deveria dizer com o que o dinheiro foi.
 */
export function listarCategoriasPagar() {
  return comTenant(async (tx) => {
    const linhas = await tx
      .selectDistinct({ categoria: contasPagar.categoria })
      .from(contasPagar)
      .where(sql`${contasPagar.categoria} is not null and btrim(${contasPagar.categoria}) <> ''`)
      .orderBy(asc(contasPagar.categoria))
    return linhas.map((l) => l.categoria as string)
  })
}
