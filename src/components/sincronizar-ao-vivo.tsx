'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/** A cada quantos milissegundos perguntar se algo mudou. */
const INTERVALO_MS = 3000

/**
 * Não renderiza nada — só pergunta, de tempos em tempos, se algo mudou nesta
 * empresa (`GET /api/sincronizar`) e chama `router.refresh()` quando sim.
 *
 * **Por que poll e não `BroadcastChannel` ou WebSocket.** Uma venda fechada
 * no PDV precisa aparecer em Painel, Estoque, Vasilhame e Financeiro — na
 * mesma aba, em outra aba do mesmo balcão, e no computador do escritório,
 * todos ao mesmo tempo. `BroadcastChannel` só alcança abas do mesmo
 * navegador; WebSocket exigiria uma conexão persistente que a Vercel
 * serverless não sustenta bem. Um poll curto alcança os três casos com o
 * mesmo código, e como o marcador é uma linha só (`company_sync`), a
 * pergunta é barata mesmo a cada poucos segundos.
 *
 * Monta uma vez por layout (`(app)` e `(pdv)`) — não por página — para que
 * toda tela de negócio fique coberta sem precisar lembrar de incluir.
 * Pausa enquanto a aba está em segundo plano: ninguém está olhando, e
 * `router.refresh()` de uma aba escondida só custaria bateria e dado móvel.
 */
export function SincronizarAoVivo() {
  const router = useRouter()
  const ultimoConhecido = useRef<string | null>(null)
  const primeiraChecagem = useRef(true)

  useEffect(() => {
    let cancelado = false

    async function checar() {
      if (document.hidden) return
      try {
        const resposta = await fetch('/api/sincronizar', { cache: 'no-store' })
        if (!resposta.ok || cancelado) return
        const { atualizadoEm } = (await resposta.json()) as { atualizadoEm: string | null }

        // Primeira checagem só grava a linha de base — não existe "mudança"
        // para comparar ainda, e disparar `refresh()` aqui recarregaria toda
        // tela assim que ela abre, sem necessidade nenhuma.
        if (primeiraChecagem.current) {
          primeiraChecagem.current = false
          ultimoConhecido.current = atualizadoEm
          return
        }

        if (atualizadoEm && atualizadoEm !== ultimoConhecido.current) {
          ultimoConhecido.current = atualizadoEm
          router.refresh()
        }
      } catch {
        // Sem rede por um instante não é motivo para parar de tentar — a
        // próxima checagem do intervalo resolve sozinha.
      }
    }

    checar()
    const id = setInterval(checar, INTERVALO_MS)
    document.addEventListener('visibilitychange', checar)

    return () => {
      cancelado = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', checar)
    }
  }, [router])

  return null
}
