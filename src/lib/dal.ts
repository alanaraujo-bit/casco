import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { withTenant, type Tx } from '@/db/tenant'
import { lerSessao, type Sessao } from '@/lib/sessao'

/**
 * Camada de acesso a dados.
 *
 * Duas funções, e toda tela de negócio passa por uma delas. O ponto de existir
 * um lugar só é que a checagem de sessão não pode ser algo que a próxima tela
 * "lembra" de fazer: esquecer o guard numa tela publica o faturamento da
 * distribuidora para quem digitar a URL.
 *
 * O `proxy.ts` também redireciona quem não tem sessão, mas isso é conveniência
 * de navegação, não segurança — ele não roda em toda forma de acesso a dados.
 * Quem de fato protege é este arquivo, no servidor, junto do dado.
 */

/**
 * Sessão válida ou redirecionamento para o login.
 *
 * `cache` da React memoiza dentro de uma mesma renderização: o layout, a página
 * e três componentes chamando isso resultam em uma verificação só.
 */
export const exigirSessao = cache(async (): Promise<Sessao> => {
  const sessao = await lerSessao()
  if (!sessao) redirect('/login')
  return sessao
})

/**
 * **O único jeito de consultar dado de negócio.**
 *
 * Junta as duas coisas que nunca podem ser feitas separadamente: exigir sessão e
 * abrir a transação com o tenant aplicado. Não existe caminho em que uma
 * aconteça sem a outra — foi por isso que viraram uma função só, e não duas
 * chamadas que alguém pode fazer pela metade.
 *
 *     const lista = await comTenant((tx) => tx.select().from(clientes))
 */
export async function comTenant<T>(fn: (tx: Tx, sessao: Sessao) => Promise<T>): Promise<T> {
  const sessao = await exigirSessao()
  return withTenant(sessao.companyId, (tx) => fn(tx, sessao))
}
