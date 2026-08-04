import 'server-only'

import { sql } from 'drizzle-orm'
import { clientes, contasReceber, vasilhameMovimentos, vasilhameSaldos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Números do Painel Gerencial.
 *
 * **Uma consulta por assunto, não uma por cartão.** O dashboard do sistema
 * antigo faz ~50 chamadas para montar a mesma tela — e ainda assim mostra
 * custo zero, o que faz Faturamento, Lucro Bruto e Lucro Líquido aparecerem
 * com o mesmo valor: uma fábrica de água que não gasta nada.
 *
 * A regra que este arquivo seguiu desde o começo continua valendo: **só entra
 * o que o banco sabe responder.** Quando ele foi escrito, a Etapa 3 não
 * existia e faturamento, vendas do dia e mix de produtos ficaram de fora, com
 * a nota explicando por quê. Agora existem, com venda gravando em seis tabelas
 * numa transação — então entram, e nenhum deles é estimativa.
 *
 * O que continua fora, e por quê: **ranking de clientes** exigiria decidir se
 * "melhor cliente" é quem compra mais ou quem paga em dia, e as duas respostas
 * mandam a operadora ligar para pessoas diferentes. Fica para quando o cliente
 * disser qual das duas ele usa.
 */

export interface ResumoPainel {
  clientes: { total: number; semTelefone: number; semDocumento: number }
  receber: { aberto: string; qtdAberto: number; vencido: string; qtdVencido: number; venceEm7: number }
  vasilhame: { comClientes: number; clientesDevendo: number; perdasMes: number; custoPerdasMes: string }
  vendas: {
    /** Faturamento líquido de hoje, na loja. É o número das 18h. */
    hoje: string
    qtdHoje: number
    /** O mesmo, no mês corrente. */
    mes: string
    qtdMes: number
    /** Mês anterior **inteiro**, para a variação não comparar 2 dias com 31. */
    mesAnterior: string
    /** Ticket médio do mês. Zero venda devolve zero, nunca `NaN`. */
    ticketMes: string
    /** Taxa de maquininha no mês — custo real, invisível se ninguém somar. */
    taxasMes: string
  }
  /** Resultado do mês corrente, pela mesma conta do DRE. */
  resultadoMes: string
  /** Faturamento dos últimos seis meses, para a forma do número. */
  serie: { mes: string; valor: number }[]
  /** Os produtos que mais faturaram no mês. */
  topProdutos: { nome: string; unidades: number; valor: string }[]
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
        // Quantos clientes estão devendo vasilhame — a pergunta do balcão.
        clientesDevendo: sql<number>`count(distinct ${vasilhameSaldos.clienteId}) filter (where ${vasilhameSaldos.quantidade} > 0)::int`,
      })
      .from(vasilhameSaldos)

    // Perda do mês corrente, lida dos movimentos com o custo congelado na linha.
    // É custo não-caixa: não passa por `caixa_movimentos` de propósito — quando
    // um vasilhame quebra, nenhum dinheiro sai da gaveta.
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

    /**
     * Vendas, resultado e a série do semestre — **uma consulta só.**
     *
     * Escrita como as do módulo de relatórios e pelo mesmo motivo: são
     * agregações sobre views que não têm espelho tipado, e o construtor do
     * Drizzle aqui só esconderia a forma da conta. O tenant continua vindo do
     * `comTenant`, e a RLS filtra igual em view e em tabela.
     *
     * Todo mês é fechado no fuso da loja. Sem isso a venda das 21h de 31 de
     * julho entra em agosto, e o dono confere o faturamento do mês contra o
     * caderno dele no dia 1º.
     */
    const [vd] = await tx.execute<{
      hoje: string
      qtd_hoje: number
      mes: string
      qtd_mes: number
      mes_anterior: string
      ticket_mes: string
      taxas_mes: string
      resultado_mes: string
    }>(sql`
      with r as (
        select date_trunc('month', (now() at time zone 'America/Belem'))     as mes,
               date_trunc('month', (now() at time zone 'America/Belem'))
                 - interval '1 month'                                        as anterior,
               (now() at time zone 'America/Belem')::date                    as hoje
      ),
      v as (
        select
          coalesce(sum(x.subtotal - x.desconto) filter (
            where (x.criado_em at time zone 'America/Belem')::date = r.hoje), 0) as hoje,
          count(*) filter (
            where (x.criado_em at time zone 'America/Belem')::date = r.hoje)     as qtd_hoje,
          coalesce(sum(x.subtotal - x.desconto) filter (
            where date_trunc('month', x.criado_em at time zone 'America/Belem') = r.mes), 0) as mes,
          count(*) filter (
            where date_trunc('month', x.criado_em at time zone 'America/Belem') = r.mes)     as qtd_mes,
          coalesce(sum(x.subtotal - x.desconto) filter (
            where date_trunc('month', x.criado_em at time zone 'America/Belem') = r.anterior), 0)
            as mes_anterior,
          coalesce(sum(x.taxas) filter (
            where date_trunc('month', x.criado_em at time zone 'America/Belem') = r.mes), 0)
            as taxas_mes
          from vendas x, r
         where x.status = 'confirmada'
           and x.criado_em >= (r.anterior at time zone 'America/Belem')
      ),
      -- As mesmas fontes do DRE, e não uma segunda contabilidade escrita aqui:
      -- dois números para a mesma pergunta em telas diferentes é como se perde
      -- a confiança do dono de uma vez só.
      cm as (select coalesce(sum(c.custo), 0) as custo from estoque_cmv c, r where c.mes = r.mes),
      pv as (select coalesce(sum(x.custo), 0) as custo from vasilhame_perdas x, r where x.mes = r.mes),
      pp as (select coalesce(sum(x.custo), 0) as custo from estoque_perdas x, r where x.mes = r.mes),
      cp as (
        select coalesce(sum(c.valor_previsto), 0) as valor
          from contas_pagar c, r
         where (c.natureza = 'despesa' or c.origem <> 'estoque')
           and date_trunc('month', c.emissao) = r.mes
      )
      select v.hoje::text         as hoje,
             v.qtd_hoje::int      as qtd_hoje,
             v.mes::text          as mes,
             v.qtd_mes::int       as qtd_mes,
             v.mes_anterior::text as mes_anterior,
             -- Divisão protegida: '0/0' não estoura em JavaScript, vira 'NaN' e
             -- contamina tudo que toca. É exatamente a origem do DRE quebrado
             -- deles, e o lugar de não deixar acontecer é aqui.
             (case when v.qtd_mes > 0 then v.mes / v.qtd_mes else 0 end)::text as ticket_mes,
             v.taxas_mes::text    as taxas_mes,
             (v.mes - v.taxas_mes - cm.custo - pv.custo - pp.custo - cp.valor)::text
               as resultado_mes
        from v, cm, pv, pp, cp
    `)

    // Seis meses, e não doze: aqui o gráfico é um cartão do painel, não o
    // relatório. Doze pontos num cartão de 300px viram um borrão — quem quer
    // o ano abre o Fluxo de Caixa Mensal, que é onde ele mora.
    const serie = await tx.execute<{ mes: string; valor: string }>(sql`
      with regua as (
        select generate_series(
                 date_trunc('month', (now() at time zone 'America/Belem')) - interval '5 months',
                 date_trunc('month', (now() at time zone 'America/Belem')),
                 interval '1 month') as m
      ),
      limites as (select min(m) as ini from regua),
      v as (
        select date_trunc('month', x.criado_em at time zone 'America/Belem') as m,
               sum(x.subtotal - x.desconto) as valor
          from vendas x, limites l
         where x.status = 'confirmada'
           and x.criado_em >= (l.ini at time zone 'America/Belem')
         group by 1
      )
      select to_char(g.m, 'YYYY-MM') as mes, coalesce(v.valor, 0)::text as valor
        from regua g left join v on v.m = g.m
       order by g.m
    `)

    // O mix de produtos do mês. Cinco linhas: é o que cabe num cartão sem
    // virar tabela, e a sexta em diante nunca muda decisão nenhuma.
    const topProdutos = await tx.execute<{ nome: string; unidades: number; valor: string }>(sql`
      select p.nome,
             sum(i.quantidade)::int as unidades,
             sum(i.total)::text     as valor
        from venda_itens i
        join vendas   v on v.id = i.venda_id
        join produtos p on p.id = i.produto_id
       where v.status = 'confirmada'
         and date_trunc('month', v.criado_em at time zone 'America/Belem')
             = date_trunc('month', (now() at time zone 'America/Belem'))
       group by p.nome
       order by sum(i.total) desc
       limit 5
    `)

    return {
      clientes: c,
      receber: r,
      vasilhame: { ...v, ...p },
      vendas: {
        hoje: vd.hoje,
        qtdHoje: vd.qtd_hoje,
        mes: vd.mes,
        qtdMes: vd.qtd_mes,
        mesAnterior: vd.mes_anterior,
        ticketMes: vd.ticket_mes,
        taxasMes: vd.taxas_mes,
      },
      resultadoMes: vd.resultado_mes,
      serie: [...serie].map((s) => ({ mes: s.mes, valor: Number(s.valor) })),
      topProdutos: [...topProdutos],
    }
  })
}
