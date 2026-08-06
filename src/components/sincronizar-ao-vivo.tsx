'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { nomeDoCanal, type EventoSincronizacao } from '@/lib/sincronizar'

/**
 * Não renderiza nada — só escuta.
 *
 * Quando outra aba desta empresa avisa que algo mudou (ver `avisarMudanca`
 * em `sincronizar.ts`), chama `router.refresh()`: o Next busca os dados do
 * Server Component de novo, no lugar, sem trocar de rota nem piscar a tela.
 * É o que faz uma venda fechada no PDV — aba própria, ver `src/app/(pdv)` —
 * aparecer em "Vendas de Produtos" sem a operadora precisar lembrar de
 * atualizar a página.
 */
export function SincronizarAoVivo({
  companyId,
  evento,
}: {
  companyId: string
  evento: EventoSincronizacao
}) {
  const router = useRouter()

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const canal = new BroadcastChannel(nomeDoCanal(companyId))
    canal.onmessage = (e) => {
      if (e.data === evento) router.refresh()
    }
    return () => canal.close()
  }, [companyId, evento, router])

  return null
}
