'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Ban, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ResultadoDesfazer } from '@/modules/financeiro/acoes'

function Botao({ ativo }: { ativo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secundario" size="sm" disabled={pending} aria-disabled={pending}>
      {ativo ? (
        <>
          <Ban aria-hidden />
          {pending ? 'Desativando…' : 'Desativar'}
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

/**
 * Liga e desliga uma conta ou uma forma de pagamento.
 *
 * **Usa `useActionState` e não uma action solta**, ao contrário do botão
 * equivalente nos outros cadastros. A diferença é que aqui a recusa é normal e
 * esperada: desativar a última conta ativa deixaria o PDV sem onde lançar a
 * venda, e a action recusa. Com uma action que devolve `void`, essa recusa
 * simplesmente não apareceria — o usuário clicaria, nada mudaria, e a única
 * conclusão possível seria que o botão está quebrado.
 */
export function BotaoAtivoMeio({
  id,
  ativo,
  acao,
}: {
  id: string
  ativo: boolean
  acao: (id: string) => Promise<ResultadoDesfazer>
}) {
  const [estado, enviar] = useActionState<ResultadoDesfazer | null, FormData>(
    async () => acao(id),
    null,
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={enviar}>
        <Botao ativo={ativo} />
      </form>
      {estado?.erro && (
        <p
          role="alert"
          className="flex max-w-[36ch] items-start gap-1 text-right text-2xs text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </p>
      )}
    </div>
  )
}
