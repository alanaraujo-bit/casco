'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Lixeira de cadastro, em dois toques — mesmo gesto do estorno de estoque.
 *
 * "Excluir" aqui inativa: o cadastro some desta lista — que só traz ativos —
 * e das telas de lançamento, mas continua explicando as vendas, contas e
 * movimentos que já apontam para ele. Reativar é decisão da ficha, não da
 * lista: sem o cadastro aparecendo aqui, quem precisa desfazer abre a ficha
 * dele direto.
 *
 * `relative` nos dois estados não é enfeite: a coluna Título destas tabelas
 * vira uma âncora que se estica pela linha inteira via `::after` (ver
 * `tabela-dados.tsx`), e um elemento `static` sob ela perde o clique para a
 * âncora mesmo estando visualmente por cima. `position: relative` sem
 * `z-index` já basta — entre um estático e um posicionado, o posicionado pinta
 * por último.
 */
export function BotaoExcluirCadastro({ aoExcluir }: { aoExcluir: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()

  function excluir() {
    iniciar(async () => {
      await aoExcluir()
      setConfirmando(false)
    })
  }

  if (!confirmando) {
    return (
      <Button
        variant="fantasma"
        size="sm"
        className="relative"
        aria-label="Excluir"
        onClick={(e) => {
          // A linha inteira é clicável nestas listas; sem isto o clique no
          // botão também navegaria, e a confirmação sumiria na troca de tela.
          e.stopPropagation()
          setConfirmando(true)
        }}
      >
        <Trash2 aria-hidden />
      </Button>
    )
  }

  return (
    <span
      className="relative flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button variant="perigo" size="sm" onClick={excluir} disabled={pendente}>
        {pendente ? 'Excluindo…' : 'Confirmar'}
      </Button>
      <Button
        variant="fantasma"
        size="sm"
        onClick={() => setConfirmando(false)}
        disabled={pendente}
      >
        Cancelar
      </Button>
    </span>
  )
}
