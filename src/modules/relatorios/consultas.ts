import 'server-only'

import { sql } from 'drizzle-orm'
import { comTenant } from '@/lib/dal'
import type { Mes } from './periodo'

/**
 * Os relatórios do dono: DRE e Fluxo de Caixa.
 *
 * **SQL cru aqui, e não o construtor do Drizzle.** É a única parte do sistema
 * onde isso vale a pena, por dois motivos: metade das fontes são as views da
 * 0011 e 0012 (`estoque_cmv`, `vasilhame_perdas`, `estoque_perdas`), que não
 * têm — nem devem ter — espelho tipado; e um DRE escrito como quinze chamadas
 * encadeadas deixa de parecer um DRE. Aqui a consulta tem a forma do relatório,
 * e dá para conferir linha a linha contra o papel.
 *
 * O tenant continua vindo do `comTenant`: a RLS filtra igual, view ou tabela,
 * porque todas rodam com `security_invoker`.
 *
 * **Os dois regimes, e por que os dois existem.**
 *
 *   O DRE é por *competência* — o resultado do mês em que o fato aconteceu.
 *   A venda entra no dia em que foi feita, mesmo que o cliente pague em três
 *   parcelas; a mercadoria vira custo no dia em que saiu, não no dia em que foi
 *   comprada; o galão quebrado é custo e nenhum real saiu da gaveta.
 *
 *   O Fluxo de Caixa é por *caixa* — o dinheiro que entrou e saiu de fato.
 *
 * Os dois não batem, e não é erro: essa diferença é a resposta para "vendi bem
 * e estou sem dinheiro". O sistema antigo não responde nem uma coisa nem outra,
 * porque o DRE exibe `NaN` (auditoria §4a) e o dashboard mostra custo zero.
 */

/* ============================================================ DRE */

export interface Dre {
  mes: Mes
  /** Vendas confirmadas, antes do desconto. */
  receitaBruta: number
  descontos: number
  /** Quantas vendas formaram a receita. Dá escala ao número. */
  qtdVendas: number
  /** Custo das mercadorias vendidas, ao custo médio congelado na saída. */
  cmv: number
  /** Taxa da maquininha. Custo real que o sistema antigo não desconta em lugar nenhum. */
  taxas: number
  /** Custo não-caixa. É o motivo da troca de sistema, e aparece como linha própria. */
  perdaVasilhame: number
  perdaVasilhameUnidades: number
  perdaProduto: number
  /** Contas a pagar de natureza `despesa`, por emissão. */
  despesas: number
  /** Contas a pagar de natureza `custo` que não vieram da compra de estoque. */
  outrosCustos: number
}

/**
 * O DRE do mês, em **uma** consulta.
 *
 * Cada linha do relatório é uma subconsulta escalar sobre a mesma data-âncora.
 * O Postgres resolve as oito num round-trip; o sistema antigo faz uma chamada
 * por bloco e ainda assim erra a conta.
 *
 * `${mes}` é `YYYY-MM` validado em `mesValido` antes de chegar aqui, e viaja
 * como parâmetro — nunca interpolado no texto do SQL.
 */
export function dreDoMes(mes: Mes): Promise<Dre> {
  return comTenant(async (tx) => {
    const [linha] = await tx.execute<{
      receita_bruta: string
      descontos: string
      qtd_vendas: number
      cmv: string
      taxas: string
      perda_vasilhame: string
      perda_vasilhame_unidades: number
      perda_produto: string
      despesas: string
      outros_custos: string
    }>(sql`
      with p as (select to_date(${mes}, 'YYYY-MM') as m)
      select
        -- Receita: a venda entra pela data em que foi fechada, no fuso da loja.
        -- Orçamento e venda cancelada não são receita e ficam de fora pelo status.
        coalesce((
          select sum(v.subtotal) from vendas v, p
           where v.status = 'confirmada'
             and date_trunc('month', v.criado_em at time zone 'America/Belem') = p.m
        ), 0)::text as receita_bruta,

        coalesce((
          select sum(v.desconto) from vendas v, p
           where v.status = 'confirmada'
             and date_trunc('month', v.criado_em at time zone 'America/Belem') = p.m
        ), 0)::text as descontos,

        coalesce((
          select count(*) from vendas v, p
           where v.status = 'confirmada'
             and date_trunc('month', v.criado_em at time zone 'America/Belem') = p.m
        ), 0)::int as qtd_vendas,

        -- A taxa da maquininha é congelada na venda: 1,49% do débito de hoje não
        -- muda porque a operadora corrigiu o percentual do cadastro em outubro.
        coalesce((
          select sum(v.taxas) from vendas v, p
           where v.status = 'confirmada'
             and date_trunc('month', v.criado_em at time zone 'America/Belem') = p.m
        ), 0)::text as taxas,

        coalesce((select c.custo from estoque_cmv c, p where c.mes = p.m), 0)::text as cmv,

        coalesce((select sum(x.custo)    from vasilhame_perdas x, p where x.mes = p.m), 0)::text as perda_vasilhame,
        coalesce((select sum(x.unidades) from vasilhame_perdas x, p where x.mes = p.m), 0)::int  as perda_vasilhame_unidades,
        coalesce((select sum(x.custo)    from estoque_perdas   x, p where x.mes = p.m), 0)::text as perda_produto,

        -- Contas a pagar por competência: a data de emissão, não a de pagamento.
        -- A conta de luz de julho paga em agosto é custo de julho — foi em julho
        -- que a luz acendeu. Pagá-la é assunto do Fluxo de Caixa.
        coalesce((
          select sum(c.valor_previsto) from contas_pagar c, p
           where c.natureza = 'despesa'
             and date_trunc('month', c.emissao) = p.m
        ), 0)::text as despesas,

        -- A exclusão por origem é o que impede a compra de ser contada duas
        -- vezes: o custo dela já entrou pelo CMV quando a mercadoria saiu.
        -- Ver a nota longa na 0012.
        coalesce((
          select sum(c.valor_previsto) from contas_pagar c, p
           where c.natureza = 'custo'
             and c.origem <> 'estoque'
             and date_trunc('month', c.emissao) = p.m
        ), 0)::text as outros_custos
    `)

    return {
      mes,
      receitaBruta: Number(linha.receita_bruta),
      descontos: Number(linha.descontos),
      qtdVendas: linha.qtd_vendas,
      cmv: Number(linha.cmv),
      taxas: Number(linha.taxas),
      perdaVasilhame: Number(linha.perda_vasilhame),
      perdaVasilhameUnidades: linha.perda_vasilhame_unidades,
      perdaProduto: Number(linha.perda_produto),
      despesas: Number(linha.despesas),
      outrosCustos: Number(linha.outros_custos),
    }
  })
}

/**
 * As despesas do mês abertas por categoria.
 *
 * Existe porque um total sozinho não é auditável. O dono olha "R$ 8.400 de
 * despesa" e a única pergunta possível é "com o quê?" — e no sistema antigo não
 * há resposta, o número simplesmente é. Aqui a linha do DRE abre embaixo dela.
 */
export interface DespesaCategoria {
  categoria: string
  natureza: string
  valor: number
  quantidade: number
}

export function despesasPorCategoria(mes: Mes): Promise<DespesaCategoria[]> {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{
      categoria: string
      natureza: string
      valor: string
      quantidade: number
    }>(sql`
      with p as (select to_date(${mes}, 'YYYY-MM') as m)
      select coalesce(c.categoria, 'Sem categoria') as categoria,
             c.natureza,
             sum(c.valor_previsto)::text as valor,
             count(*)::int               as quantidade
        from contas_pagar c, p
       where date_trunc('month', c.emissao) = p.m
         and (c.natureza = 'despesa' or c.origem <> 'estoque')
       group by 1, 2
       order by sum(c.valor_previsto) desc
    `)
    return linhas.map((l) => ({
      categoria: l.categoria,
      natureza: l.natureza,
      valor: Number(l.valor),
      quantidade: l.quantidade,
    }))
  })
}

/**
 * As perdas de vasilhame do mês, por motivo.
 *
 * A linha que o sistema antigo não tem, e que é o argumento inteiro do produto:
 * lá cada galão quebrado vira uma venda de centavos e infla o faturamento
 * (auditoria §5). Aqui ele desce o resultado, com o nome do que aconteceu.
 */
export interface PerdaMotivo {
  motivo: string
  unidades: number
  custo: number
}

export function perdasDoMes(mes: Mes): Promise<PerdaMotivo[]> {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{ motivo: string; unidades: number; custo: string }>(sql`
      with p as (select to_date(${mes}, 'YYYY-MM') as m)
      select x.motivo, x.unidades::int as unidades, x.custo::text as custo
        from vasilhame_perdas x, p
       where x.mes = p.m
       order by x.custo desc
    `)
    return linhas.map((l) => ({
      motivo: l.motivo,
      unidades: l.unidades,
      custo: Number(l.custo),
    }))
  })
}

/**
 * Receita e resultado dos últimos `n` meses — a forma do número ao lado do DRE.
 *
 * Um DRE de um mês só não diz se o mês foi bom. A série responde isso antes de
 * qualquer explicação, e é a mesma agregação da tela do mês repetida por mês —
 * não uma segunda contabilidade escrita em outro lugar, que é como se chega a
 * dois relatórios que discordam.
 */
export interface ResultadoMes {
  mes: Mes
  receita: number
  resultado: number
}

export function resultadoPorMes(meses = 12): Promise<ResultadoMes[]> {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{ mes: string; receita: string; resultado: string }>(sql`
      -- A régua de meses vem do generate_series e não das linhas de venda: mês
      -- sem faturamento nenhum precisa aparecer como zero. É literalmente o
      -- defeito (c) da auditoria — o Fluxo de Caixa Mensal deles vai de janeiro
      -- a outubro porque novembro e dezembro não existem na tabela.
      with regua as (
        select generate_series(
                 date_trunc('month', (now() at time zone 'America/Belem'))
                   - make_interval(months => ${meses - 1}),
                 date_trunc('month', (now() at time zone 'America/Belem')),
                 interval '1 month'
               ) as m
      )
      select to_char(r.m, 'YYYY-MM') as mes,
             coalesce(vd.receita, 0)::text as receita,
             (
               coalesce(vd.receita, 0) - coalesce(vd.taxas, 0)
               - coalesce(cmv.custo, 0)
               - coalesce(pv.custo, 0) - coalesce(pp.custo, 0)
               - coalesce(cp.valor, 0)
             )::text as resultado
        from regua r
        left join lateral (
          select sum(v.subtotal - v.desconto) as receita, sum(v.taxas) as taxas
            from vendas v
           where v.status = 'confirmada'
             and date_trunc('month', v.criado_em at time zone 'America/Belem') = r.m
        ) vd on true
        left join lateral (select c.custo from estoque_cmv    c where c.mes = r.m) cmv on true
        left join lateral (select sum(x.custo) as custo from vasilhame_perdas x where x.mes = r.m) pv on true
        left join lateral (select sum(x.custo) as custo from estoque_perdas   x where x.mes = r.m) pp on true
        left join lateral (
          select sum(c.valor_previsto) as valor
            from contas_pagar c
           where date_trunc('month', c.emissao) = r.m
             and (c.natureza = 'despesa' or c.origem <> 'estoque')
        ) cp on true
       order by r.m
    `)
    return linhas.map((l) => ({
      mes: l.mes,
      receita: Number(l.receita),
      resultado: Number(l.resultado),
    }))
  })
}
