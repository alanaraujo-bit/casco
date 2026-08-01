'use client'

import { useFormStatus } from 'react-dom'
import { Ban, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { alternarAtivoFornecedor } from '@/modules/fornecedores/acoes'

function Botao({ ativo }: { ativo: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="secundario" disabled={pending} aria-disabled={pending}>
      {ativo ? (
        <>
          <Ban aria-hidden />
          {pending ? 'Inativando…' : 'Inativar'}
        </>
      ) : (
        <>
          <RotateCcw aria-hidden />
          {pending ? 'Reativando…' : 'Reativar'}
        </>
      )}
    </Button>
  )
}

export function BotaoAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const alternar = alternarAtivoFornecedor.bind(null, id, !ativo)

  return (
    <form action={alternar}>
      <Botao ativo={ativo} />
    </form>
  )
}
