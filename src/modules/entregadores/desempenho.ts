import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'
import { entregadores, vendas } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { dataNaLoja, formatarDataISO, FUSO } from '@/lib/formatos'

/**
 * Desempenho por entregador.
 *
 * **O período é um intervalo de datas na loja, não um instante.** Toda consulta
 * daqui compara `(criado_em at time zone 'America/Belem')::date` com duas
 * strings `YYYY-MM-DD` calculadas do mesmo jeito. Comparar o `timestamptz` cru
 * com `now() - interval '7 days'` daria "sete dias e algumas horas" contados do
 * relógio do servidor: uma venda das 21h de sábado cairia no domingo, e a
 * semana do entregador fecharia diferente da semana do caixa.
 *
 * **Só venda confirmada entra.** Orçamento não é entrega feita, e venda
 * cancelada deixou de ser — somá-las produziria um ranking em que o primeiro
 * lugar é de quem teve mais venda desfeita.
 */

/* ------------------------------------------------------------- o período */

export const PERIODOS = ['semana', 'semana-passada', 'mes', 'mes-passado'] as const
export type Periodo = (typeof PERIODOS)[number]

export const ROTULO_PERIODO: Record<Periodo, string> = {
  semana: 'Esta semana',
  'semana-passada': 'Semana passada',
  mes: 'Este mês',
  'mes-passado': 'Mês passado',
}

/** O usuário edita a barra de endereços. Valor estranho vira o padrão. */
export function periodoValido(valor: string | undefined): Periodo {
  return PERIODOS.includes(valor as Periodo) ? (valor as Periodo) : 'semana'
}

export interface Intervalo {
  de: string
  ate: string
  rotulo: string
  /** `03/08 a 09/08` — a linha fina que diz de que dias se está falando. */
  detalhe: string
  /** Quantos dias o intervalo cobre. Vira a média por dia. */
  dias: number
}

/** Soma dias sobre `YYYY-MM-DD` em UTC — mesma aritmética de `dataNaLoja`. */
function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const base = new Date(Date.UTC(ano, mes - 1, dia))
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

function diferencaEmDias(de: string, ate: string): number {
  const dia = 86_400_000
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / dia) + 1
}

/**
 * As quatro janelas que a tela oferece, resolvidas em datas.
 *
 * A semana começa na **segunda**, e não no domingo do calendário: a distribuidora
 * fecha rota de segunda a sábado, e uma semana que começa no domingo joga o
 * sábado — o dia mais cheio — para dentro da semana seguinte, bem no meio da
 * comparação que o dono está fazendo.
 */
export function intervaloDoPeriodo(periodo: Periodo): Intervalo {
  const hoje = dataNaLoja()
  const [ano, mes, dia] = hoje.split('-').map(Number)
  // 0 = domingo no `getUTCDay`; queremos quantos dias se passaram desde a
  // segunda-feira, então domingo vira 6.
  const desdeSegunda = (new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() + 6) % 7

  const faixa = (de: string, ate: string): Intervalo => ({
    de,
    ate,
    rotulo: ROTULO_PERIODO[periodo],
    detalhe: `${formatarDataISO(de)} a ${formatarDataISO(ate)}`,
    dias: diferencaEmDias(de, ate),
  })

  switch (periodo) {
    case 'semana':
      return faixa(somarDias(hoje, -desdeSegunda), hoje)
    case 'semana-passada': {
      const inicio = somarDias(hoje, -desdeSegunda - 7)
      return faixa(inicio, somarDias(inicio, 6))
    }
    case 'mes': {
      const inicio = `${hoje.slice(0, 7)}-01`
      return faixa(inicio, hoje)
    }
    case 'mes-passado': {
      const inicio = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10)
      // Dia 0 do mês seguinte é o último dia deste — cobre 28, 29, 30 e 31 sem
      // uma tabela de quantos dias tem cada mês.
      const fim = new Date(Date.UTC(ano, mes - 1, 0)).toISOString().slice(0, 10)
      return faixa(inicio, fim)
    }
  }
}

/* ------------------------------------------------------------- o ranking */

/**
 * O dia da venda **no fuso da loja**, para agrupar e comparar. Ver a nota do topo.
 *
 * O fuso entra como literal no SQL, e não como parâmetro, porque esta expressão
 * aparece ao mesmo tempo no `select` e no `group by` de `entregasPorDia`. Como
 * parâmetro, cada ocorrência ganharia um número diferente (`$1` e `$4`), e o
 * Postgres compara a expressão do `group by` com a do `select` pela árvore: dois
 * parâmetros distintos não são a mesma coisa, e a consulta morre com "column
 * vendas.criado_em must appear in the GROUP BY clause". `FUSO` é uma constante
 * do próprio código, nunca entrada de usuário.
 */
const diaDaVenda = sql`(${vendas.criadoEm} at time zone ${sql.raw(`'${FUSO}'`)})::date`

/** Venda confirmada, dentro do intervalo, no fuso da loja. */
const noPeriodo = (de: string, ate: string) =>
  and(
    eq(vendas.status, 'confirmada'),
    // O `::date` é explícito: sem ele o parâmetro chega como `unknown` e a
    // comparação depende do Postgres adivinhar o tipo certo.
    sql`${diaDaVenda} between ${de}::date and ${ate}::date`,
  )

export interface LinhaDesempenho {
  /** `null` na linha das vendas que ninguém marcou. Ver a nota em `rankingEntregadores`. */
  id: string | null
  nome: string
  ativo: boolean
  entregas: number
  /** Galões de produto retornável — a mesma definição da listagem de vendas. */
  agua: number
  /** Vasilhames vazios que voltaram junto com a entrega. */
  devolvido: number
  valor: number
  /** Clientes distintos atendidos. Venda de balcão sem cliente não conta. */
  clientes: number
  ticket: number
}

/**
 * O ranking do período, do que mais vendeu para o que menos vendeu.
 *
 * **Entregador sem venda no período aparece, com zeros.** Some-lo faria a lista
 * parecer curta e certa quando na verdade está incompleta — e "o Fulano não
 * aparece" é uma informação diferente de "o Fulano não entregou nada", que é a
 * que o dono precisa.
 *
 * **Venda sem entregador marcado também aparece**, numa linha própria. Ela é o
 * número que explica por que a soma do ranking não bate com o faturamento do
 * período, e escondê-la deixaria a diferença sem explicação nenhuma na tela.
 */
export function rankingEntregadores(de: string, ate: string) {
  const agua = sql<number>`coalesce(sum((
    select coalesce(sum(vi.quantidade), 0)
      from venda_itens vi
      join produtos p on p.id = vi.produto_id
     where vi.venda_id = ${vendas.id} and p.retornavel
  )), 0)::float8`

  const devolvido = sql<number>`coalesce(sum((
    select coalesce(sum(vi.vasilhame_devolvido), 0)
      from venda_itens vi
     where vi.venda_id = ${vendas.id}
  )), 0)::int`

  return comTenant(async (tx) => {
    const [movimento, cadastrados] = await Promise.all([
      tx
        .select({
          id: vendas.entregadorId,
          nome: entregadores.nome,
          ativo: entregadores.ativo,
          entregas: sql<number>`count(*)::int`,
          valor: sql<number>`coalesce(sum(${vendas.total}), 0)::float8`,
          clientes: sql<number>`count(distinct ${vendas.clienteId})::int`,
          agua,
          devolvido,
        })
        .from(vendas)
        .leftJoin(entregadores, eq(entregadores.id, vendas.entregadorId))
        .where(noPeriodo(de, ate))
        .groupBy(vendas.entregadorId, entregadores.nome, entregadores.ativo),

      tx
        .select({ id: entregadores.id, nome: entregadores.nome, ativo: entregadores.ativo })
        .from(entregadores)
        .where(eq(entregadores.ativo, true))
        .orderBy(asc(entregadores.nome)),
    ])

    const porId = new Map(movimento.map((m) => [m.id, m]))

    const linhas: LinhaDesempenho[] = cadastrados.map((e) => {
      const m = porId.get(e.id)
      return {
        id: e.id,
        nome: e.nome,
        ativo: e.ativo,
        entregas: m?.entregas ?? 0,
        agua: Number(m?.agua ?? 0),
        devolvido: Number(m?.devolvido ?? 0),
        valor: Number(m?.valor ?? 0),
        clientes: m?.clientes ?? 0,
        ticket: m && m.entregas > 0 ? Number(m.valor) / m.entregas : 0,
      }
    })

    // Quem entregou no período mas já foi desativado no cadastro: continua no
    // ranking do passado, porque o passado não muda quando alguém sai.
    for (const m of movimento) {
      if (m.id && !cadastrados.some((e) => e.id === m.id)) {
        linhas.push({
          id: m.id,
          nome: m.nome ?? 'Entregador removido',
          ativo: m.ativo ?? false,
          entregas: m.entregas,
          agua: Number(m.agua),
          devolvido: Number(m.devolvido),
          valor: Number(m.valor),
          clientes: m.clientes,
          ticket: m.entregas > 0 ? Number(m.valor) / m.entregas : 0,
        })
      }
    }

    const semMarcacao = movimento.find((m) => m.id === null)
    if (semMarcacao) {
      linhas.push({
        id: null,
        nome: 'Sem entregador marcado',
        ativo: true,
        entregas: semMarcacao.entregas,
        agua: Number(semMarcacao.agua),
        devolvido: Number(semMarcacao.devolvido),
        valor: Number(semMarcacao.valor),
        clientes: semMarcacao.clientes,
        ticket:
          semMarcacao.entregas > 0 ? Number(semMarcacao.valor) / semMarcacao.entregas : 0,
      })
    }

    // Ordem: valor vendido, decrescente. A linha "sem entregador" fica sempre no
    // fim — ela não disputa o ranking, ela o explica.
    return linhas.sort((a, b) => {
      if (a.id === null) return 1
      if (b.id === null) return -1
      return b.valor - a.valor || b.entregas - a.entregas || a.nome.localeCompare(b.nome, 'pt-BR')
    })
  })
}

/* --------------------------------------------------------- o dia a dia */

export interface DiaDeEntrega {
  /** `YYYY-MM-DD` */
  data: string
  /** `seg 03/08` — o rótulo do eixo. */
  rotulo: string
  entregas: number
  valor: number
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Quantas entregas por dia no período, incluindo os dias parados.
 *
 * O dia sem venda entra com zero em vez de sumir: a coluna vazia de terça é a
 * informação, e um gráfico que pula os dias parados mostra uma semana cheia que
 * não existiu.
 */
export function entregasPorDia(de: string, ate: string) {
  return comTenant(async (tx) => {
    const linhas = await tx
      .select({
        data: sql<string>`to_char(${diaDaVenda}, 'YYYY-MM-DD')`,
        entregas: sql<number>`count(*)::int`,
        valor: sql<number>`coalesce(sum(${vendas.total}), 0)::float8`,
      })
      .from(vendas)
      .where(noPeriodo(de, ate))
      .groupBy(diaDaVenda)

    const porData = new Map(linhas.map((l) => [l.data, l]))
    const total = diferencaEmDias(de, ate)

    return Array.from({ length: total }, (_, i): DiaDeEntrega => {
      const data = somarDias(de, i)
      const [ano, mes, dia] = data.split('-').map(Number)
      const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
      const l = porData.get(data)
      return {
        data,
        rotulo: `${DIAS_CURTOS[semana]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
        entregas: l?.entregas ?? 0,
        valor: Number(l?.valor ?? 0),
      }
    })
  })
}
