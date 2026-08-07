'use client'

import { AvisoErro } from '@/components/ui/aviso-erro'
import type { Falha } from '@/lib/erros'
import { useState, useTransition } from 'react'
import { Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cancelarVenda } from '@/modules/vendas/acoes'

/**
 * Cancelamento em dois toques, com senha — a exclusão de uma venda.
 *
 * Não some da tela: a linha fica, com o selo "Cancelada", porque estoque,
 * vasilhame e caixa continuam apontando para ela. Ver a nota de
 * `cancelarVenda` em `modules/vendas/acoes.ts`. A senha é a segunda trava,
 * separada da confirmação — clicar duas vezes sem querer não cancela nada.
 */
export function BotaoCancelar({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<Falha | string | null>(null)
  const [pendente, iniciar] = useTransition()

  function cancelar() {
    setErro(null)
    iniciar(async () => {
      const r = await cancelarVenda(id, senha)
      if (!r.ok) setErro(r.erro ?? 'Não foi possível cancelar.')
      else setConfirmando(false)
    })
  }

  if (!confirmando) {
    return (
      <Button
        variant="fantasma"
        size="sm"
        aria-label="Cancelar venda"
        onClick={(e) => {
          // A linha inteira é clicável; sem isto o clique no botão também
          // navegaria, e a confirmação sumiria na troca de tela.
          e.stopPropagation()
          setConfirmando(true)
        }}
      >
        <Ban aria-hidden />
      </Button>
    )
  }

  return (
    <span
      className="flex flex-wrap items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="h-8 w-28"
        autoFocus
        disabled={pendente}
      />
      <Button variant="perigo" size="sm" onClick={cancelar} disabled={pendente || !senha}>
        {pendente ? 'Cancelando…' : 'Confirmar'}
      </Button>
      <Button
        variant="fantasma"
        size="sm"
        onClick={() => {
          setConfirmando(false)
          setSenha('')
          setErro(null)
        }}
        disabled={pendente}
      >
        Voltar
      </Button>
      {erro && <AvisoErro erro={erro} className="w-full" />}
    </span>
  )
}
