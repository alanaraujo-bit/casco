import { sql } from 'drizzle-orm'
import { db } from './client'

/** Transação com o tenant já aplicado. É o único tipo que as queries recebem. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Executa `fn` dentro de uma transação com `app.company_id` definido, que é o
 * que as políticas de RLS leem para filtrar as linhas.
 *
 * **Toda query de negócio passa por aqui.** Não existe atalho: fora deste
 * wrapper, `app.company_id` não está definido, as políticas negam tudo e a
 * query volta vazia. Falha fechada, de propósito.
 *
 * O terceiro argumento do `set_config` (`true`) é o detalhe que importa: torna
 * o valor local à transação. Sem ele o valor persistiria na conexão, e como o
 * PgBouncer recicla conexões entre requisições, a próxima requisição herdaria
 * o tenant da anterior — vazando dado de uma distribuidora para outra.
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`)
    return fn(tx)
  })
}
