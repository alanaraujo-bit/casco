/**
 * Service worker de demolição.
 *
 * O Casco não usa service worker. Este arquivo existe porque `localhost:3000`
 * é uma origem compartilhada por todos os projetos da máquina, e service
 * worker é registrado POR ORIGEM, não por projeto — um outro app que rodou
 * aqui antes deixou o dele instalado, e ele continua interceptando as
 * requisições do Casco, servindo HTML em cache de outro sistema e provocando
 * recarregamento infinito.
 *
 * O navegador consulta `/sw.js` de tempos em tempos para ver se o worker
 * mudou. Quando ele consultar, encontra este, instala como atualização — e a
 * primeira coisa que este faz é apagar todo o cache e se desregistrar.
 *
 * Também protege em produção: se um dia o Casco tiver PWA de verdade e depois
 * a gente desistir, o worker antigo iria sobreviver na máquina dos usuários
 * sem nenhuma forma de alcançá-lo. É a única saída para esse problema.
 */

self.addEventListener('install', () => {
  // Assume o controle sem esperar as abas abertas fecharem.
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(nomes.map((n) => caches.delete(n)))
      await self.registration.unregister()

      // Recarrega as abas controladas UMA vez, já sem worker no caminho.
      const clientes = await self.clients.matchAll({ type: 'window' })
      for (const cliente of clientes) cliente.navigate(cliente.url)
    })(),
  )
})

// Enquanto este worker estiver ativo, nada de cache: tudo direto na rede.
self.addEventListener('fetch', (evento) => {
  evento.respondWith(fetch(evento.request))
})
