import 'server-only'

import { sql } from 'drizzle-orm'
import { clientes, contasReceber, vasilhameMovimentos, vasilhameSaldos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Números do Painel Gerencial.
 *
 * **Só o que o banco sabe responder hoje.** Faturamento, vendas do dia, mix de
 * produtos e ranking de clientes dependem da Etapa 3 (Vendas), que não existe —
 * então não aparecem. Cartão com número inventado é pior que cartão ausente: o
 * dono confere um deles contra a realidade, erra, e a partir daí não acredita
 * em mais nenhum número do sistema.
 *
 * Uma consulta por assunto, não uma por cartão. O dashboard do sistema antigo
 * faz ~50 chamadas para montar a mesma tela.
 */

export interface ResumoPainel {
  clientes: { total: number; semTelefone: number; semDocumento: number }
  receber: { aberto: string; qtdAberto: number; vencido: string; qtdVencido: number; venceEm7: number }
  vasilhame: { comClientes: number; clientesDevendo: number; perdasMes: number; custoPerdasMes: string }
}

export function resumoPainel(): Promise<ResumoPainel> {
  return comTenant(async (tx) => {
    const [c] = await tx
      .select({
        total: sql<number>`count(*) filter (where ${clientes.ativo})::int`,
        semTelefone: sql<number>`count(*) filter (where ${clientes.ativo} and ${clientes.telefone} is null)::int`,
        semDocumento: sql<number>`count(*) filter (where ${clientes.ativo} and ${clientes.documento} is null)::int`,
      })
      .from(clientes)

    const aberto = sql`${contasReceber.pagoEm} is null`
    const vencido = sql`${contasReceber.pagoEm} is null and ${contasReceber.vencimento} < current_date`

    const [r] = await tx
      .select({
        aberto: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${aberto}), 0)`,
        qtdAberto: sql<number>`count(*) filter (where ${aberto})::int`,
        vencido: sql<string>`coalesce(sum(${contasReceber.valorParcela}) filter (where ${vencido}), 0)`,
        qtdVencido: sql<number>`count(*) filter (where ${vencido})::int`,
        venceEm7: sql<number>`count(*) filter (where ${aberto} and ${contasReceber.vencimento} between current_date and current_date + 7)::int`,
      })
      .from(contasReceber)

    const [v] = await tx
      .select({
        comClientes: sql<number>`coalesce(sum(${vasilhameSaldos.quantidade}), 0)::int`,
        // Quantos clientes estão devendo galão — a pergunta do balcão.
        clientesDevendo: sql<number>`count(distinct ${vasilhameSaldos.clienteId}) filter (where ${vasilhameSaldos.quantidade} > 0)::int`,
      })
      .from(vasilhameSaldos)

    // Perda do mês corrente, lida dos movimentos com o custo congelado na linha.
    // É custo não-caixa: não passa por `caixa_movimentos` de propósito — quando
    // um galão quebra, nenhum dinheiro sai da gaveta.
    const [p] = await tx
      .select({
        perdasMes: sql<number>`coalesce(sum(-${vasilhameMovimentos.quantidade}), 0)::int`,
        custoPerdasMes: sql<string>`coalesce(sum(-${vasilhameMovimentos.quantidade} * ${vasilhameMovimentos.custoUnitario}), 0)`,
      })
      .from(vasilhameMovimentos)
      .where(
        sql`${vasilhameMovimentos.motivo} in ('quebrado', 'trincado', 'perdido')
            and ${vasilhameMovimentos.criadoEm} >= date_trunc('month', current_date)`,
      )

    return {
      clientes: c,
      receber: r,
      vasilhame: { ...v, ...p },
    }
  })
}
