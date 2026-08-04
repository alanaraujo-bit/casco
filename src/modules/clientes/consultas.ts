import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'
import { clientes, tabelasPreco, vasilhameSaldos } from '@/db/schema'
import { comTenant } from '@/lib/dal'

/**
 * Leituras da tela de Clientes.
 *
 * Todas passam por `comTenant()`, que exige sessão e abre a transação com
 * `app.company_id` aplicado. Não existe atalho: fora dele a RLS nega tudo e a
 * consulta volta vazia — falha fechada, de propósito.
 */

export interface ClienteLista {
  id: string
  codigo: number | null
  nome: string
  tipo: string
  documento: string | null
  telefone: string | null
  bairro: string | null
  cidade: string | null
  ativo: boolean
  /** Galões em poder do cliente. Some os saldos de todos os tipos de vasilhame. */
  vasilhames: number
}

/**
 * Lista para a tabela.
 *
 * O saldo de vasilhame entra por subconsulta e não por `join` + `group by`:
 * agrupar a listagem inteira por causa de uma coluna faria toda coluna nova
 * precisar entrar no `group by`, e é assim que a listagem passa a somar errado
 * quando alguém acrescenta um campo meses depois.
 *
 * Sem paginação no banco por enquanto: a JM tem 30 clientes e a `TabelaDados`
 * já pagina, busca e ordena no cliente. Trazer tudo é mais rápido e mais
 * simples até a casa dos milhares — e aí o lugar de mudar é só aqui.
 */
export function listarClientes() {
  const saldo = sql<number>`coalesce((
    select sum(${vasilhameSaldos.quantidade})
      from ${vasilhameSaldos}
     where ${vasilhameSaldos.clienteId} = ${clientes.id}
  ), 0)`

  return comTenant(async (tx) =>
    tx
      .select({
        id: clientes.id,
        codigo: clientes.codigo,
        nome: clientes.nome,
        tipo: clientes.tipo,
        documento: clientes.documento,
        telefone: clientes.telefone,
        bairro: clientes.bairro,
        cidade: clientes.cidade,
        ativo: clientes.ativo,
        vasilhames: saldo,
      })
      .from(clientes)
      // Só ativos: cliente excluído (inativado pela lixeira da lista) some
      // daqui. Reativar é decisão da ficha, que continua acessível por link
      // direto mesmo sem o cliente aparecer nesta lista.
      .where(eq(clientes.ativo, true))
      .orderBy(asc(clientes.nome)),
  ) as Promise<ClienteLista[]>
}

/**
 * Métricas do cabeçalho, na mesma consulta da contagem.
 *
 * Quatro `select count` separados dariam quatro viagens ao banco para responder
 * uma pergunta só — é assim que um painel acaba abrindo com dezenas de
 * chamadas e demorando o que demora.
 */
export function metricasClientes() {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        comDocumento: sql<number>`count(*) filter (where ${clientes.documento} is not null)::int`,
        comTelefone: sql<number>`count(*) filter (where ${clientes.telefone} is not null)::int`,
        inativos: sql<number>`count(*) filter (where not ${clientes.ativo})::int`,
      })
      .from(clientes)

    const [galoes] = await tx
      .select({ total: sql<number>`coalesce(sum(${vasilhameSaldos.quantidade}), 0)::int` })
      .from(vasilhameSaldos)

    return { ...linha, galoesNaRua: galoes?.total ?? 0 }
  })
}

/** Um cliente para a tela de edição. `null` quando não existe — ou é de outro tenant. */
export function acharCliente(id: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx.select().from(clientes).where(eq(clientes.id, id)).limit(1)
    return linha ?? null
  })
}

/** Tabelas de preço ativas, para o `<select>` do formulário. */
export function listarTabelasPreco() {
  return comTenant((tx) =>
    tx
      .select({ id: tabelasPreco.id, nome: tabelasPreco.nome, padrao: tabelasPreco.padrao })
      .from(tabelasPreco)
      .where(eq(tabelasPreco.ativo, true))
      .orderBy(asc(tabelasPreco.nome)),
  )
}

/**
 * O documento já pertence a outro cadastro?
 *
 * O banco tem índice único e rejeitaria de qualquer forma — mas o erro que ele
 * devolve é ilegível para quem está no balcão. Isto existe para transformar
 * essa rejeição numa frase útil, apontando qual cadastro já tem o documento.
 * A trava de verdade continua sendo a do banco.
 */
export function acharPorDocumento(documento: string, exceto?: string) {
  return comTenant(async (tx) => {
    const [linha] = await tx
      .select({ id: clientes.id, nome: clientes.nome, codigo: clientes.codigo })
      .from(clientes)
      .where(
        exceto
          ? and(eq(clientes.documento, documento), sql`${clientes.id} <> ${exceto}`)
          : eq(clientes.documento, documento),
      )
      .limit(1)
    return linha ?? null
  })
}
