import 'server-only'

import { sql } from 'drizzle-orm'
import { companySync } from '@/db/schema'
import type { Tx } from '@/db/tenant'
import { withTenant } from '@/db/tenant'

/**
 * Avisa que algo mudou nesta empresa. Chame dentro da mesma transação da
 * gravação de negócio — venda, baixa, entrada de estoque, cadastro — em vez
 * de abrir uma transação própria: se a gravação for revertida, o aviso tem
 * que reverter junto, senão uma venda que falhou faria as outras telas
 * buscarem dado que não mudou.
 *
 * Não é fila de eventos: é um `upsert` de uma linha só, e o único dado que
 * carrega é "agora". Quem lê (`lerUltimaMudanca`, via `GET /api/sincronizar`)
 * só precisa saber que o instante avançou para mandar as telas buscarem dado
 * de novo — não o que mudou, nem onde.
 */
export async function marcarMudanca(tx: Tx, companyId: string): Promise<void> {
  await tx
    .insert(companySync)
    .values({ companyId })
    .onConflictDoUpdate({
      target: companySync.companyId,
      set: { atualizadoEm: sql`now()` },
    })
}

/** Instante do último `marcarMudanca` desta empresa, ou `null` se nunca houve. */
export async function lerUltimaMudanca(companyId: string): Promise<Date | null> {
  const [linha] = await withTenant(companyId, (tx) =>
    tx.select({ atualizadoEm: companySync.atualizadoEm }).from(companySync),
  )
  return linha?.atualizadoEm ?? null
}
