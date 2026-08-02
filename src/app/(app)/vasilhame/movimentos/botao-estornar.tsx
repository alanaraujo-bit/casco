'use client'

import { AvisoErro } from '@/components/ui/aviso-erro'
import type { Falha } from '@/lib/erros'
import { useState, useTransition } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { estornarMovimento } from '@/modules/vasilhame/acoes'

/**
 * Estorno em dois toques, sem caixa de diálogo.
 *
 * Confirmação em dois passos porque estornar é irreversível — o estorno não se
 * estorna, e o único caminho de volta seria lançar um movimento novo com o
 * motivo errado. Dois passos e não um `confirm()` do navegador porque aquele
 * bloqueia a aba inteira, ignora o tema e, no celular, aparece colado no topo,
 * longe do dedo e longe da linha que ele está falando sobre.
 */
export function BotaoEstornar({ id, estornado }: { id: string; estornado: boolean }) {
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<Falha | string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (estornado) {
    return <span className="text-xs text-texto-fraco">estornado</span>
  }

  function estornar() {
    setErro(null)
    iniciar(async () => {
      const r = await estornarMovimento(id)
      if (!r.ok) setErro(r.erro ?? 'Não foi possível estornar.')
      else setConfirmando(false)
    })
  }

  if (!confirmando) {
    return (
      <Button
        variant="fantasma"
        size="sm"
        onClick={(e) => {
          // A linha inteira é clicável em algumas tabelas; sem isto o clique
          // no botão também navegaria, e a confirmação sumiria na troca de tela.
          e.stopPropagation()
          setConfirmando(true)
        }}
      >
        <Undo2 aria-hidden />
        Estornar
      </Button>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="perigo" size="sm" onClick={estornar} disabled={pendente}>
        {pendente ? 'Estornando…' : 'Confirmar'}
      </Button>
      <Button
        variant="fantasma"
        size="sm"
        onClick={() => {
          setConfirmando(false)
          setErro(null)
        }}
        disabled={pendente}
      >
        Cancelar
      </Button>
      {erro && <AvisoErro erro={erro} className="w-full" />}
    </span>
  )
}
