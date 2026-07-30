import { uuidv7 } from 'uuidv7'

/**
 * Gera o identificador de qualquer registro do sistema.
 *
 * UUID v7 e nao v4 por causa do app do entregador: o celular precisa criar
 * registros offline, sem consultar o servidor. UUID resolve a colisão; a
 * versão 7 resolve o resto — os primeiros bits são o timestamp, então os IDs
 * saem ordenados por tempo. Isso mantém a inserção no índice B-tree localizada
 * (v4 espalha e fragmenta) e dá ordem cronológica natural sem coluna extra.
 *
 * Também é o que torna a sincronização idempotente: o ID vem do dispositivo,
 * então reenviar a mesma operação bate em `on conflict do nothing` em vez de
 * duplicar a entrega.
 */
export function newId(): string {
  return uuidv7()
}
