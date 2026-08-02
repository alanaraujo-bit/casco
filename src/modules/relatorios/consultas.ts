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
 * e estou sem dinheiro" — e só aparece quando os dois relatórios existem lado
 * a lado, cada um com o seu critério declarado.
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
  /** Taxa da maquininha. Custo real, e por isso linha própria do DRE. */
  taxas: number
  /** Custo não-caixa. Linha própria: o dono precisa ver quanto o casco custou. */
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
 * O Postgres resolve as oito num round-trip, em vez de uma chamada por bloco.
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
      with p as (select to_date(${mes}, 'YYYY-MM') as m),

      -- Uma passada por tabela, e não uma por linha do relatório.
      --
      -- Era uma subconsulta escalar por número, e quatro delas varriam 'vendas'
      -- com exatamente o mesmo filtro para trazer receita, desconto, contagem e
      -- taxa. O plano não deduplica isso, e a tela levava 15 segundos.
      -- Agregar uma vez e ler quatro colunas é a mesma resposta em um quarto do
      -- trabalho — e é o que a Etapa 6 promete: relatório em uma consulta.
      vd as (
        -- A venda entra pela data em que foi fechada, no fuso da loja.
        -- Orçamento e venda cancelada não são receita, e saem pelo status.
        --
        -- A taxa da maquininha é congelada na venda: 1,49% do débito de hoje
        -- não muda porque alguém corrigiu o percentual do cadastro em outubro.
        select coalesce(sum(v.subtotal), 0) as bruta,
               coalesce(sum(v.desconto), 0) as desconto,
               coalesce(sum(v.taxas), 0)    as taxas,
               count(*)                     as qtd
          from vendas v, p
         where v.status = 'confirmada'
           and date_trunc('month', v.criado_em at time zone 'America/Belem') = p.m
      ),

      -- Contas a pagar por competência: a data de emissão, não a de pagamento.
      -- A conta de luz de julho paga em agosto é custo de julho — foi em julho
      -- que a luz acendeu. Pagá-la é assunto do Fluxo de Caixa.
      --
      -- A exclusão por origem é o que impede a compra de ser contada duas
      -- vezes: o custo dela já entrou pelo CMV quando a mercadoria saiu. Ver a
      -- nota longa na 0012.
      cp as (
        select coalesce(sum(c.valor_previsto) filter (where c.natureza = 'despesa'), 0)
                 as despesas,
               coalesce(sum(c.valor_previsto)
                 filter (where c.natureza = 'custo' and c.origem <> 'estoque'), 0)
                 as outros
          from contas_pagar c, p
         where date_trunc('month', c.emissao) = p.m
      ),

      pv as (
        select coalesce(sum(x.custo), 0) as custo, coalesce(sum(x.unidades), 0) as unidades
          from vasilhame_perdas x, p where x.mes = p.m
      ),
      pp as (select coalesce(sum(x.custo), 0) as custo from estoque_perdas x, p where x.mes = p.m),
      cm as (select coalesce(sum(c.custo), 0) as custo from estoque_cmv   c, p where c.mes = p.m)

      select vd.bruta::text     as receita_bruta,
             vd.desconto::text  as descontos,
             vd.qtd::int        as qtd_vendas,
             vd.taxas::text     as taxas,
             cm.custo::text     as cmv,
             pv.custo::text     as perda_vasilhame,
             pv.unidades::int   as perda_vasilhame_unidades,
             pp.custo::text     as perda_produto,
             cp.despesas::text  as despesas,
             cp.outros::text    as outros_custos
        from vd, cp, pv, pp, cm
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
 * despesa" e a única pergunta possível é "com o quê?". Um total sem abertura
 * não responde: o número simplesmente é. Aqui a linha do DRE abre embaixo dela.
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
 * A linha que é o argumento inteiro do produto: galão quebrado é prejuízo, não
 * venda de centavos. Aqui ele desce o resultado, com o nome do que aconteceu.
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
      ),

      -- Cada fonte agregada **uma vez**, por mês, e depois casada com a régua.
      --
      -- Eram cinco 'left join lateral' correlacionados com 'r.m', o que faz o
      -- Postgres reexecutar cada um doze vezes — e as views de perda carregam
      -- um 'not exists' correlacionado por linha, então doze varreduras viravam
      -- a tela de 15 segundos que apareceu no 'npm run fluxo'. Aqui cada tabela
      -- é lida uma vez e o 'group by' faz o trabalho que o laço fazia.
      --
      -- O corte por período vive em cada CTE, e não só no join: sem ele o
      -- 'group by' agregaria o histórico inteiro para depois jogar fora doze
      -- meses — barato hoje, caro no terceiro ano da distribuidora.
      limites as (select min(m) as ini, max(m) as fim from regua),

      vd as (
        select date_trunc('month', v.criado_em at time zone 'America/Belem') as m,
               sum(v.subtotal - v.desconto) as receita,
               sum(v.taxas)                 as taxas
          from vendas v, limites l
         where v.status = 'confirmada'
           and date_trunc('month', v.criado_em at time zone 'America/Belem')
               between l.ini and l.fim
         group by 1
      ),
      cp as (
        select date_trunc('month', c.emissao) as m,
               sum(c.valor_previsto)          as valor
          from contas_pagar c, limites l
         where (c.natureza = 'despesa' or c.origem <> 'estoque')
           and date_trunc('month', c.emissao) between l.ini and l.fim
         group by 1
      ),
      pv as (
        select x.mes as m, sum(x.custo) as custo
          from vasilhame_perdas x, limites l
         where x.mes between l.ini and l.fim
         group by 1
      ),
      pp as (
        select x.mes as m, sum(x.custo) as custo
          from estoque_perdas x, limites l
         where x.mes between l.ini and l.fim
         group by 1
      ),
      cm as (
        select c.mes as m, sum(c.custo) as custo
          from estoque_cmv c, limites l
         where c.mes between l.ini and l.fim
         group by 1
      )

      select to_char(r.m, 'YYYY-MM') as mes,
             coalesce(vd.receita, 0)::text as receita,
             (
               coalesce(vd.receita, 0) - coalesce(vd.taxas, 0)
               - coalesce(cm.custo, 0)
               - coalesce(pv.custo, 0) - coalesce(pp.custo, 0)
               - coalesce(cp.valor, 0)
             )::text as resultado
        from regua r
        left join vd on vd.m = r.m
        left join cp on cp.m = r.m
        left join pv on pv.m = r.m
        left join pp on pp.m = r.m
        left join cm on cm.m = r.m
       order by r.m
    `)
    return linhas.map((l) => ({
      mes: l.mes,
      receita: Number(l.receita),
      resultado: Number(l.resultado),
    }))
  })
}

/* ============================================================ fluxo de caixa
 *
 * Aqui é o outro regime: **só dinheiro que entrou ou saiu de fato.**
 *
 * A ausência mais importante destas duas telas é a perda de vasilhame. Galão
 * quebrado é custo e aparece no DRE, mas nenhum real sai da gaveta quando ele
 * quebra — então não tem linha aqui, e não é esquecimento. `caixa_movimentos`
 * nunca recebe perda, por decisão registrada desde a migration 0005.
 *
 * As duas consultas partem de uma régua de datas gerada pelo `generate_series`,
 * e não das linhas de `caixa_movimentos`. É o defeito (c) da auditoria: o Fluxo
 * de Caixa Mensal deles vai de janeiro a outubro, e novembro e dezembro
 * simplesmente não existem — porque a tela lista o que a tabela tem, e a tabela
 * não tinha lançamento naqueles meses. Um mês sem movimento é uma informação
 * ("não entrou nada"), não uma linha ausente.
 */

export interface DiaCaixa {
  /** `YYYY-MM-DD`. */
  data: string
  /** `01/08/2026`, já formatado no banco para não passar por `new Date`. */
  dataBr: string
  /** "segunda-feira". Coluna consagrada do caixa diário. */
  diaSemana: string
  /** Sábado ou domingo — a leitura de "por que este dia entrou menos". */
  fimDeSemana: boolean
  entrada: number
  saida: number
  /** Entrada − saída **do dia**. */
  saldo: number
  /** Saldo acumulado desde o começo do mês. É o que o "Saldo" deles não é. */
  acumulado: number
  quantidade: number
}

/**
 * Fluxo de Caixa Diário — Data · Dia Semana · Entrada · Saída · Saldo · Banco.
 *
 * Colunas na ordem consagrada, com uma acrescentada: o
 * **saldo acumulado** ao lado do saldo do dia. Sem ele a coluna "Saldo"
 * responde "sobrou quanto na terça?" e nunca "sobrou quanto até aqui?" — e a
 * segunda é a pergunta que faz alguém abrir um fluxo de caixa.
 *
 * A régua vai do primeiro ao último dia do mês, feriado e domingo incluídos.
 * Dia sem movimento aparece zerado, e é isso que permite ler a semana.
 */
export function caixaDiario(mes: Mes): Promise<DiaCaixa[]> {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{
      data: string
      data_br: string
      dia_semana: string
      fim_de_semana: boolean
      entrada: string
      saida: string
      quantidade: number
    }>(sql`
      with p as (select to_date(${mes}, 'YYYY-MM') as m),
      regua as (
        select generate_series(p.m, (p.m + interval '1 month' - interval '1 day')::date,
                               interval '1 day')::date as d
          from p
      ),
      -- Uma varredura de 'caixa_movimentos', e não uma por dia.
      --
      -- Era um 'left join lateral' correlacionado com 'r.d', o que reexecuta a
      -- subconsulta 31 vezes. Agregar por dia primeiro e casar com a régua
      -- depois dá a mesma resposta lendo a tabela uma vez — e é a diferença
      -- entre a tela abrir e a tela expirar, que foi o que aconteceu no
      -- 'npm run fluxo' com o DRE.
      mv as (
        select c.data as d,
               sum(c.valor) filter (where c.sentido = 'entrada') as entrada,
               sum(c.valor) filter (where c.sentido = 'saida')   as saida,
               count(*)                                          as quantidade
          from caixa_movimentos c, p
         where c.data >= p.m and c.data < p.m + interval '1 month'
         group by c.data
      )
      select to_char(r.d, 'YYYY-MM-DD') as data,
             to_char(r.d, 'DD/MM/YYYY') as data_br,
             -- to_char com TMDay traduziria para o locale do servidor, que na
             -- Vercel é o padrão do sistema e não pt-BR — a coluna sairia em
             -- inglês em produção e em português aqui. O nome do dia é montado
             -- por índice, que não depende de configuração de lugar nenhum.
             (array['domingo','segunda-feira','terça-feira','quarta-feira',
                    'quinta-feira','sexta-feira','sábado'])[extract(dow from r.d)::int + 1]
               as dia_semana,
             extract(dow from r.d) in (0, 6) as fim_de_semana,
             coalesce(mv.entrada, 0)::text   as entrada,
             coalesce(mv.saida, 0)::text     as saida,
             coalesce(mv.quantidade, 0)::int as quantidade
        from regua r
        left join mv on mv.d = r.d
       order by r.d
    `)

    // O acumulado é somado aqui e não no SQL de propósito: uma função de janela
    // devolveria o mesmo número, e este laço é legível por quem for conferir o
    // relatório contra o extrato — que é a única razão pela qual esta coluna
    // existe.
    let acumulado = 0
    return linhas.map((l) => {
      const entrada = Number(l.entrada)
      const saida = Number(l.saida)
      const saldo = entrada - saida
      acumulado += saldo
      return {
        data: l.data,
        dataBr: l.data_br,
        diaSemana: l.dia_semana,
        fimDeSemana: l.fim_de_semana,
        entrada,
        saida,
        saldo,
        acumulado,
        quantidade: l.quantidade,
      }
    })
  })
}

export interface MesCaixa {
  mes: Mes
  entrada: number
  saida: number
  saldo: number
  quantidade: number
}

/**
 * Fluxo de Caixa Mensal — **doze meses, sempre.**
 *
 * O deles tem dez, e não por escolha: a tela lista os meses que aparecem na
 * tabela, e novembro e dezembro não tinham lançamento. O dono
 * abre o relatório do ano e vê o ano faltando dois meses, sem nada na tela que
 * explique se o negócio parou ou se o sistema esqueceu.
 *
 * A régua resolve isso na origem: os doze meses existem porque o calendário os
 * tem, não porque houve movimento neles.
 */
export function caixaMensal(meses = 12, ate?: Mes): Promise<MesCaixa[]> {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{
      mes: string
      entrada: string
      saida: string
      quantidade: number
    }>(sql`
      -- String vazia e não null como ausência: um parâmetro nulo dentro de
      -- to_date deixa o Postgres sem tipo para inferir e a consulta nem chega
      -- a rodar. O nullif devolve a ausência depois, já com tipo.
      with fim as (
        select coalesce(to_date(nullif(${ate ?? ''}, ''), 'YYYY-MM'),
                        date_trunc('month', (now() at time zone 'America/Belem'))::date) as m
      ),
      regua as (
        select generate_series(fim.m - make_interval(months => ${meses - 1}),
                               fim.m, interval '1 month')::date as m
          from fim
      ),
      -- Uma varredura, não doze. Mesma correção do Diário — ver a nota lá.
      --
      -- O recorte é por 'c.data' e não pelo mês truncado: comparar a coluna
      -- crua com duas datas deixa o índice 'caixa_company_idx (company_id,
      -- data)' utilizável, enquanto filtrar por 'date_trunc(...)' obrigaria a
      -- ler a tabela inteira para depois descartar.
      limites as (select min(m) as ini, max(m) as fim from regua),
      mv as (
        select date_trunc('month', c.data)::date as m,
               sum(c.valor) filter (where c.sentido = 'entrada') as entrada,
               sum(c.valor) filter (where c.sentido = 'saida')   as saida,
               count(*)                                          as quantidade
          from caixa_movimentos c, limites l
         where c.data >= l.ini
           and c.data < (l.fim + interval '1 month')
         group by 1
      )
      select to_char(r.m, 'YYYY-MM')      as mes,
             coalesce(mv.entrada, 0)::text   as entrada,
             coalesce(mv.saida, 0)::text     as saida,
             coalesce(mv.quantidade, 0)::int as quantidade
        from regua r
        left join mv on mv.m = r.m
       order by r.m
    `)

    return linhas.map((l) => {
      const entrada = Number(l.entrada)
      const saida = Number(l.saida)
      return { mes: l.mes, entrada, saida, saldo: entrada - saida, quantidade: l.quantidade }
    })
  })
}

/**
 * O saldo em conta **antes** do mês começar.
 *
 * Sem ele o acumulado do Fluxo de Caixa Diário responde "quanto se moveu no
 * mês", que não é o que alguém quer saber ao abrir a tela — a pergunta é
 * quanto há em caixa em cada dia. Soma o saldo inicial das contas com tudo que
 * se moveu antes do dia 1º.
 */
export function saldoAntesDoMes(mes: Mes): Promise<number> {
  return comTenant(async (tx) => {
    const [linha] = await tx.execute<{ saldo: string }>(sql`
      with p as (select to_date(${mes}, 'YYYY-MM') as m)
      select (
        coalesce((select sum(b.saldo_inicial) from contas_bancarias b where b.ativo), 0)
        + coalesce((
            select sum(case when c.sentido = 'entrada' then c.valor else -c.valor end)
              from caixa_movimentos c, p
             where c.data < p.m
          ), 0)
      )::text as saldo
    `)
    return Number(linha.saldo)
  })
}
