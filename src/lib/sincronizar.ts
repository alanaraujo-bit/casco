/**
 * Sincronização entre abas da mesma empresa — via `BroadcastChannel`, sem
 * servidor no meio.
 *
 * Existe porque o PDV vive numa aba própria (ver `src/app/(pdv)`): fechar
 * uma venda ali não pode deixar "Vendas de Produtos", aberta em outra aba,
 * desatualizada até alguém lembrar de apertar F5. `BroadcastChannel` é a API
 * do navegador para exatamente isto — mensagem entre abas do mesmo site, sem
 * round-trip a servidor nenhum, então o efeito é imediato.
 *
 * Escopado por `companyId` e não um canal único do site inteiro: suporte com
 * duas empresas abertas ao mesmo tempo (ver `FaixaAdmin`) não pode fazer uma
 * venda na empresa A recarregar a tela que está olhando a empresa B.
 */
export type EventoSincronizacao = 'vendas'

function nomeDoCanal(companyId: string): string {
  return `casco:sync:${companyId}`
}

/** Avisa as outras abas desta empresa que algo mudou. Chame depois de gravar. */
export function avisarMudanca(companyId: string, evento: EventoSincronizacao) {
  if (typeof BroadcastChannel === 'undefined') return
  const canal = new BroadcastChannel(nomeDoCanal(companyId))
  canal.postMessage(evento)
  canal.close()
}

export { nomeDoCanal }
