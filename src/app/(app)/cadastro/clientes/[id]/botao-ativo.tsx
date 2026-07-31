'use client'

import { useFormStatus } from 'react-dom'
import { Ban, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { alternarAtivoCliente } from '@/modules/clientes/acoes'

/**
 * Inativar e reativar. **Não existe apagar.**
 *
 * Cliente carrega venda, título e extrato de vasilhame. Apagar levaria junto o
 * histórico que explica o saldo — e no dia em que ele reclamasse de estar
 * devendo galão, não haveria como responder. Inativo some das listas de venda e
 * continua existindo para o histórico.
 *
 * **`<form action>` e não `onClick` + `useTransition`.** O motivo que vale é
 * simples: assim o botão funciona mesmo se o JavaScript não carregar, e o
 * `useFormStatus` dá o estado de "salvando" de graça. Inativar um cliente é
 * escrita no banco — não deve depender de um bundle ter chegado inteiro.
 */
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
  // Os dois argumentos ficam fechados no servidor. O `formData` chega como
  // terceiro parâmetro e a action ignora — ela não lê nada do formulário, de
  // propósito: não há campo que o navegador possa alterar.
  const alternar = alternarAtivoCliente.bind(null, id, !ativo)

  return (
    <form action={alternar}>
      <Botao ativo={ativo} />
    </form>
  )
}
