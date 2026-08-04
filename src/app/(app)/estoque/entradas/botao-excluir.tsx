'use client'

import { AvisoErro } from '@/components/ui/aviso-erro'
import type { Falha } from '@/lib/erros'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { excluirMovimento } from '@/modules/estoque/acoes'

/**
 * Exclusão em dois toques, gêmea do botão de estornar.
 *
 * A diferença entre os dois não é o gesto — é o que cada um significa: estornar
 * corrige um lançamento errado e deixa as duas linhas à vista; excluir tira o
 * lançamento de vez do que conta, e a linha que sobra na tela é só o registro
 * de que a exclusão aconteceu.
 */
export function BotaoExcluir({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<Falha | string | null>(null)
  const [pendente, iniciar] = useTransition()

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await excluirMovimento(id)
      if (!r.ok) setErro(r.erro ?? 'Não foi possível excluir.')
      else setConfirmando(false)
    })
  }

  if (!confirmando) {
    return (
      <Button
        variant="fantasma"
        size="sm"
        aria-label="Excluir"
        onClick={(e) => {
          // A linha inteira é clicável; sem isto o clique no botão também
          // navegaria, e a confirmação sumiria na troca de tela.
          e.stopPropagation()
          setConfirmando(true)
        }}
      >
        <Trash2 aria-hidden />
      </Button>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="perigo" size="sm" onClick={excluir} disabled={pendente}>
        {pendente ? 'Excluindo…' : 'Confirmar'}
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
