import 'server-only'

import { asc, sql } from 'drizzle-orm'
import { clientes, contasBancarias, contasReceber, formasPagamento } from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Leituras de Contas a Receber.
 *
 * A situação (`Recebido` · `Em aberto` · `Vencido`) é **derivada** de `pago_em`
 * e `vencimento`, nunca de um campo digitado. No sistema antigo dá para ver
 * linha marcada "Vencido" com vencimento no mês que vem — é o tipo de erro que
 * só existe porque alguém guardou como dado o que era consequência.
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
 * Colunas na ordem da listagem deles (auditoria §3): Origem · Código ·
 * Cliente/Descrição · Emissão · Valor Total · Parcela · Valor Parcela ·
 * Vencimento · Recebido? · Banco · Forma Pgto · Taxas · Data Pgto · Valor Pago.
 */
export function listarContasReceber() {
  return comTenant((tx) =>
    tx
      .select({
        id: contasReceber.id,
        origem: contasReceber.origem,
        codigo: contasReceber.codigo,
        // Título avulso não tem cliente; a descrição ocupa o lugar. É a mesma
        // coluna "Cliente / Descrição" que eles já leem.
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
      .orderBy(asc(contasReceber.vencimento)),
  ) as Promise<TituloLista[]>
}

/**
 * Os quatro cartões do cabeçalho, em **uma** consulta.
 *
 * Somam por PARCELA e não pelo valor total do título: um título de R$ 1.200 em
 * 3× tem R$ 400 vencendo agora, e é isso que o dono precisa ver. Somar o total
 * inflaria "a receber" em três vezes — e ele soma de cabeça, então acha o erro.
 */
export function metricasReceber() {
  return comTenant(async (tx) => {
    const aberto = sql`${contasReceber.pagoEm} is null`
    const vencido = sql`${contasReceber.pagoEm} is null and ${contasReceber.vencimento} < current_date`

    const [linha] = await tx
      .select({
        totalLancado: sql<string>`coalesce(sum(${contasReceber.valorParcela}), 0)`,
        qtdTotal: sql<number>`count(*)::int`,
        recebido: sql<string>`coalesce(sum(${contasReceber.valorPago}) filter (where ${contasReceber.pagoEm} is not null), 0)`,
        qtdRecebido: sql<number>`count(*) filter (where ${contasReceber.pagoEm} is not null)::int`,
        emAberto: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${aberto}), 0)`,
        qtdAberto: sql<number>`count(*) filter (where ${aberto})::int`,
        vencido: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${vencido}), 0)`,
        qtdVencido: sql<number>`count(*) filter (where ${vencido})::int`,
        // Para-brisa, não retrovisor: o que ainda dá para evitar.
        venceEm7: sql<number>`count(*) filter (where ${aberto} and ${contasReceber.vencimento} between current_date and current_date + 7)::int`,
      })
      .from(contasReceber)

    return linha
  })
}
