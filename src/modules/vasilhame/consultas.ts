import 'server-only'

import { and, asc, desc, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import {
  clientes,
  produtos,
  users,
  vasilhameMovimentos,
  vasilhameSaldos,
  MOTIVOS_PERDA,
  type MotivoVasilhame,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Leituras do módulo de vasilhame.
 *
 * Todas passam por `comTenant()` — fora dele a RLS nega tudo e a consulta volta
 * vazia. O saldo nunca é somado aqui a partir do histórico: quem soma é o
 * trigger, em `vasilhame_saldos`. Se um dia esta camada começar a recalcular
 * saldo "para conferir", passam a existir dois números com direito de estar
 * certos — e o dia em que discordarem ninguém vai saber qual acreditar.
 */

/* ------------------------------------------------------------- vasilhames */

export interface VasilhameOpcao {
  id: string
  nome: string
  custo: string
  /** Quantos estão na rua, somando todos os clientes. */
  naRua: number
}

/**
 * Os produtos que valem como vasilhame.
 *
 * Não é "todo produto ativo", e a diferença importa: se a lista trouxer
 * `Água 20L` junto de `Galão 20L vazio`, a operadora vai escolher o primeiro
 * que reconhecer — e o saldo de comodato passa a contar água, que não volta.
 *
 * Vale como vasilhame quem é apontado por `produtos.vasilhame_id` (foi
 * configurado como o galão de algum produto) ou quem já tem movimento lançado
 * (foi usado como vasilhame antes, e esconder agora quebraria o extrato).
 */
export function listarVasilhames() {
  const naRua = sql<number>`coalesce((
    select sum(${vasilhameSaldos.quantidade})
      from ${vasilhameSaldos}
     where ${vasilhameSaldos.produtoId} = ${produtos.id}
  ), 0)::int`

  // Subconsultas escritas à mão, com os parênteses à vista, em vez de embutir
  // um query builder no template: o `in` de um builder embutido depende de a
  // biblioteca lembrar de parentizar, e um `in select ...` sem parênteses é
  // erro de sintaxe que só aparece em runtime — na tela, para a operadora.
  const configuradoOuUsado = sql`(
    ${produtos.id} in (select vasilhame_id from produtos where vasilhame_id is not null)
    or ${produtos.id} in (select produto_id from vasilhame_movimentos)
  )`

  return comTenant((tx) =>
    tx
      .select({ id: produtos.id, nome: produtos.nome, custo: produtos.custo, naRua })
      .from(produtos)
      .where(and(eq(produtos.ativo, true), configuradoOuUsado))
      .orderBy(asc(produtos.nome)),
  ) as Promise<VasilhameOpcao[]>
}

/* --------------------------------------------------------------- clientes */

export interface ClienteOpcao {
  id: string
  codigo: number | null
  nome: string
  /** Saldo somado de todos os tipos de vasilhame. Aparece ao lado do nome. */
  devendo: number
}

/**
 * Clientes para o seletor da baixa, com o que ele já deve.
 *
 * O saldo vem junto de propósito: no balcão, a conferência que importa é
 * "ele diz que está devolvendo 5, o sistema diz que ele tem 3". Mostrar o
 * número no momento da escolha é o que transforma isso numa pergunta feita na
 * hora, e não num saldo negativo descoberto três meses depois.
 */
export function listarClientesParaBaixa() {
  const devendo = sql<number>`coalesce((
    select sum(${vasilhameSaldos.quantidade})
      from ${vasilhameSaldos}
     where ${vasilhameSaldos.clienteId} = ${clientes.id}
  ), 0)::int`

  return comTenant((tx) =>
    tx
      .select({ id: clientes.id, codigo: clientes.codigo, nome: clientes.nome, devendo })
      .from(clientes)
      .where(eq(clientes.ativo, true))
      .orderBy(asc(clientes.nome)),
  ) as Promise<ClienteOpcao[]>
}

/** Saldo de um cliente num vasilhame específico. Alimenta o recibo pós-lançamento. */
export function saldoDoCliente(clienteId: string, produtoId: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({ quantidade: vasilhameSaldos.quantidade })
      .from(vasilhameSaldos)
      .where(
        and(eq(vasilhameSaldos.clienteId, clienteId), eq(vasilhameSaldos.produtoId, produtoId)),
      )
      .limit(1)
    return linha?.quantidade ?? 0
  })
}

/* ----------------------------------------------------------------- saldos */

export interface SaldoLista {
  clienteId: string
  clienteCodigo: number | null
  cliente: string
  telefone: string | null
  produtoId: string
  produto: string
  quantidade: number
  atualizadoEm: Date
}

/**
 * Quem está devendo galão — a pergunta mais frequente do balcão.
 *
 * Saldo zero fica de fora. Cliente que pegou e devolveu tudo não é uma linha
 * que alguém precise ler; deixá-lo aqui só faria a lista crescer até esconder
 * quem de fato está devendo. O histórico dele continua inteiro no extrato.
 */
export function listarSaldos() {
  return comTenant((tx) =>
    tx
      .select({
        clienteId: vasilhameSaldos.clienteId,
        clienteCodigo: clientes.codigo,
        cliente: clientes.nome,
        telefone: clientes.telefone,
        produtoId: vasilhameSaldos.produtoId,
        produto: produtos.nome,
        quantidade: vasilhameSaldos.quantidade,
        atualizadoEm: vasilhameSaldos.atualizadoEm,
      })
      .from(vasilhameSaldos)
      .innerJoin(clientes, eq(clientes.id, vasilhameSaldos.clienteId))
      .innerJoin(produtos, eq(produtos.id, vasilhameSaldos.produtoId))
      .where(ne(vasilhameSaldos.quantidade, 0))
      .orderBy(desc(vasilhameSaldos.quantidade), asc(clientes.nome)),
  ) as Promise<SaldoLista[]>
}

/**
 * Os números do cabeçalho, em uma viagem por pergunta e não uma por cartão.
 *
 * A perda vem separada e **em custo**, não em receita. É o número que o sistema
 * antigo não sabe produzir: lá as baixas viraram vendas de centavos, então
 * "quanto perdemos em galão" só existe somando venda de valor estranho na mão.
 */
export function metricasVasilhame() {
  return comTenant(async (tx) => {
    const [rua] = await tx
      .select({
        naRua: sql<number>`coalesce(sum(${vasilhameSaldos.quantidade}), 0)::int`,
        clientesDevendo: sql<number>`count(*) filter (where ${vasilhameSaldos.quantidade} > 0)::int`,
      })
      .from(vasilhameSaldos)

    const [perdas] = await tx
      .select({
        unidades: sql<number>`coalesce(sum(-${vasilhameMovimentos.quantidade}), 0)::int`,
        custo: sql<string>`coalesce(sum(-${vasilhameMovimentos.quantidade} * ${vasilhameMovimentos.custoUnitario}), 0)::text`,
      })
      .from(vasilhameMovimentos)
      .where(
        and(
          inArray(vasilhameMovimentos.motivo, [...MOTIVOS_PERDA]),
          sql`${vasilhameMovimentos.criadoEm} >= date_trunc('month', now())`,
          // Perda estornada não é perda. Mesma exclusão da view `vasilhame_perdas`.
          sql`${vasilhameMovimentos.estornoDe} is null`,
          sql`not exists (select 1 from vasilhame_movimentos e where e.estorno_de = ${vasilhameMovimentos.id})`,
        ),
      )

    const [mes] = await tx
      .select({
        entregues: sql<number>`coalesce(sum(${vasilhameMovimentos.quantidade}) filter (where ${vasilhameMovimentos.motivo} = 'entregue'), 0)::int`,
        devolvidos: sql<number>`coalesce(sum(-${vasilhameMovimentos.quantidade}) filter (where ${vasilhameMovimentos.motivo} = 'devolvido'), 0)::int`,
      })
      .from(vasilhameMovimentos)
      .where(sql`${vasilhameMovimentos.criadoEm} >= date_trunc('month', now())`)

    return {
      naRua: rua?.naRua ?? 0,
      clientesDevendo: rua?.clientesDevendo ?? 0,
      perdaUnidades: perdas?.unidades ?? 0,
      perdaCusto: perdas?.custo ?? '0',
      entreguesMes: mes?.entregues ?? 0,
      devolvidosMes: mes?.devolvidos ?? 0,
    }
  })
}

/* ---------------------------------------------------------------- extrato */

export interface LinhaExtrato {
  id: string
  criadoEm: Date
  motivo: MotivoVasilhame
  produto: string
  produtoId: string
  quantidade: number
  /** Saldo do cliente naquele vasilhame **depois** deste movimento. */
  saldoApos: number
  custoUnitario: string
  observacao: string | null
  usuario: string | null
  origem: string | null
  /** Preenchido quando esta linha desfaz outra. Vira selo "estorno" no extrato. */
  estornoDe: string | null
  /** Esta linha já foi desfeita por outra. Aparece riscada. */
  estornado: boolean
}

/**
 * O extrato que responde "por que eu estou devendo 12 galões?".
 *
 * O saldo corrente sai de uma função de janela e não de um laço no JavaScript:
 * somar em memória obrigaria a trazer o histórico inteiro para calcular a
 * última linha, e a conta pararia de fechar no dia em que a tela ganhasse
 * paginação. Aqui a soma é por vasilhame (`partition by`) porque devolver um
 * galão de 20L não abate um de 10L — e é exatamente essa mistura que faz o
 * cliente e o sistema chegarem a números diferentes.
 */
export function extratoCliente(clienteId: string) {
  const saldoApos = sql<number>`(sum(${vasilhameMovimentos.quantidade}) over (
    partition by ${vasilhameMovimentos.produtoId}
    order by ${vasilhameMovimentos.criadoEm}, ${vasilhameMovimentos.id}
  ))::int`

  // O estorno soma normalmente no saldo corrente — é assim que ele desfaz de
  // verdade. O que ele não faz é sumir com a linha original: as duas ficam à
  // vista, e é isso que permite ao cliente conferir a correção em vez de ter
  // que confiar nela.
  const estornado = sql<boolean>`exists (
    select 1 from vasilhame_movimentos e where e.estorno_de = ${vasilhameMovimentos.id}
  )`

  return comTenant((tx) =>
    tx
      .select({
        id: vasilhameMovimentos.id,
        criadoEm: vasilhameMovimentos.criadoEm,
        motivo: vasilhameMovimentos.motivo,
        produto: produtos.nome,
        produtoId: vasilhameMovimentos.produtoId,
        quantidade: vasilhameMovimentos.quantidade,
        saldoApos,
        custoUnitario: vasilhameMovimentos.custoUnitario,
        observacao: vasilhameMovimentos.observacao,
        usuario: users.nome,
        origem: vasilhameMovimentos.origem,
        estornoDe: vasilhameMovimentos.estornoDe,
        estornado,
      })
      .from(vasilhameMovimentos)
      .innerJoin(produtos, eq(produtos.id, vasilhameMovimentos.produtoId))
      .leftJoin(users, eq(users.id, vasilhameMovimentos.usuarioId))
      .where(eq(vasilhameMovimentos.clienteId, clienteId))
      .orderBy(desc(vasilhameMovimentos.criadoEm), desc(vasilhameMovimentos.id)),
  ) as Promise<LinhaExtrato[]>
}

/** Cabeçalho da página de extrato: quem é o cliente e o que ele deve, por vasilhame. */
export function resumoDoCliente(clienteId: string) {
  return comTenant(async (tx) => {
    const [pessoa] = await tx
      .select({
        id: clientes.id,
        codigo: clientes.codigo,
        nome: clientes.nome,
        telefone: clientes.telefone,
        bairro: clientes.bairro,
        ativo: clientes.ativo,
      })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1)

    if (!pessoa) return null

    const porVasilhame = await tx
      .select({
        produtoId: vasilhameSaldos.produtoId,
        produto: produtos.nome,
        quantidade: vasilhameSaldos.quantidade,
      })
      .from(vasilhameSaldos)
      .innerJoin(produtos, eq(produtos.id, vasilhameSaldos.produtoId))
      .where(eq(vasilhameSaldos.clienteId, clienteId))
      .orderBy(asc(produtos.nome))

    return { ...pessoa, porVasilhame }
  })
}

/* ------------------------------------------------------------- movimentos */

export interface MovimentoLista {
  id: string
  criadoEm: Date
  motivo: MotivoVasilhame
  cliente: string | null
  clienteId: string | null
  produto: string
  quantidade: number
  custoUnitario: string
  /** Custo total já com sinal resolvido. Zero para o que não é perda. */
  custoPerda: string
  observacao: string | null
  usuario: string | null
  estornoDe: string | null
  estornado: boolean
}

/**
 * O razão completo, em ordem cronológica invertida.
 *
 * Sem paginação no banco, pela mesma razão da listagem de clientes: a JM lança
 * dezenas de movimentos por semana, e a `TabelaDados` já pagina, busca e ordena
 * do lado do cliente. Quando passar de alguns milhares, o lugar de mudar é
 * aqui, sozinho.
 */
export function listarMovimentos() {
  /**
   * Mesma regra da view `vasilhame_perdas`, e não por acaso: o total que a tela
   * soma tem que ser o mesmo que o DRE vai ler. Estorno não é perda, e linha
   * estornada deixou de ser — se a tela contasse os dois, o número que a
   * operadora vê aqui já nasceria brigando com o relatório do contador.
   */
  const custoPerda = sql<string>`(case
    when ${vasilhameMovimentos.motivo} in ('quebrado', 'trincado', 'perdido')
     and ${vasilhameMovimentos.estornoDe} is null
     and not exists (
           select 1 from vasilhame_movimentos e where e.estorno_de = ${vasilhameMovimentos.id}
         )
    then -${vasilhameMovimentos.quantidade} * ${vasilhameMovimentos.custoUnitario}
    else 0
  end)::text`

  const estornado = sql<boolean>`exists (
    select 1 from vasilhame_movimentos e where e.estorno_de = ${vasilhameMovimentos.id}
  )`

  return comTenant((tx) =>
    tx
      .select({
        id: vasilhameMovimentos.id,
        criadoEm: vasilhameMovimentos.criadoEm,
        motivo: vasilhameMovimentos.motivo,
        cliente: clientes.nome,
        clienteId: vasilhameMovimentos.clienteId,
        produto: produtos.nome,
        quantidade: vasilhameMovimentos.quantidade,
        custoUnitario: vasilhameMovimentos.custoUnitario,
        custoPerda,
        observacao: vasilhameMovimentos.observacao,
        usuario: users.nome,
        estornoDe: vasilhameMovimentos.estornoDe,
        estornado,
      })
      .from(vasilhameMovimentos)
      .innerJoin(produtos, eq(produtos.id, vasilhameMovimentos.produtoId))
      .leftJoin(clientes, eq(clientes.id, vasilhameMovimentos.clienteId))
      .leftJoin(users, eq(users.id, vasilhameMovimentos.usuarioId))
      .orderBy(desc(vasilhameMovimentos.criadoEm), desc(vasilhameMovimentos.id)),
  ) as Promise<MovimentoLista[]>
}

/**
 * Perdas por mês e motivo, lidas da view `vasilhame_perdas`.
 *
 * Da view e não de um `group by` repetido aqui: é a mesma fonte que o DRE vai
 * ler na Etapa 6, e duas somas escritas em lugares diferentes é como se chega
 * a um relatório que não bate com a tela que o originou.
 */
export function perdasPorMes(meses = 6) {
  return comTenant(async (tx) => {
    const linhas = await tx.execute<{
      mes: string
      motivo: string
      unidades: number
      custo: string
    }>(sql`
      select to_char(mes, 'YYYY-MM') as mes,
             motivo,
             unidades::int as unidades,
             custo::text   as custo
        from vasilhame_perdas
       -- O fuso aparece dos dois lados da comparação de propósito: desde a 0012
       -- a coluna mes da view é o mês fechado em Tucumã, e comparar com um
       -- date_trunc sobre now() em UTC traria um mês a mais na virada.
       where mes >= date_trunc('month', (now() at time zone 'America/Belem'))
                    - make_interval(months => ${meses - 1})
       order by mes desc, motivo
    `)
    return [...linhas]
  })
}

/** Existe pelo menos um vasilhame configurado? Decide o estado vazio da baixa. */
export function temVasilhameConfigurado() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(eq(produtos.ativo, true), isNotNull(produtos.vasilhameId)))
      .limit(1)
    return Boolean(linha)
  })
}

/** Últimos lançamentos, para o rodapé da tela de baixa — conferência imediata. */
export function ultimosMovimentos(limite = 5) {
  return comTenant((tx) =>
    tx
      .select({
        id: vasilhameMovimentos.id,
        criadoEm: vasilhameMovimentos.criadoEm,
        motivo: vasilhameMovimentos.motivo,
        cliente: clientes.nome,
        produto: produtos.nome,
        quantidade: vasilhameMovimentos.quantidade,
      })
      .from(vasilhameMovimentos)
      .innerJoin(produtos, eq(produtos.id, vasilhameMovimentos.produtoId))
      .leftJoin(clientes, eq(clientes.id, vasilhameMovimentos.clienteId))
      .orderBy(desc(vasilhameMovimentos.criadoEm), desc(vasilhameMovimentos.id))
      .limit(limite),
  )
}

/** Clientes com saldo positivo, do maior para o menor. Alimenta o topo da tela de saldos. */
export function maioresDevedores(limite = 5) {
  return comTenant((tx) =>
    tx
      .select({
        clienteId: vasilhameSaldos.clienteId,
        cliente: clientes.nome,
        total: sql<number>`sum(${vasilhameSaldos.quantidade})::int`,
      })
      .from(vasilhameSaldos)
      .innerJoin(clientes, eq(clientes.id, vasilhameSaldos.clienteId))
      .where(gt(vasilhameSaldos.quantidade, 0))
      .groupBy(vasilhameSaldos.clienteId, clientes.nome)
      .orderBy(desc(sql`sum(${vasilhameSaldos.quantidade})`))
      .limit(limite),
  )
}
