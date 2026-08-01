'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trocarSenha, type EstadoSenha } from '@/modules/admin/acoes'

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      className="w-full"
      disabled={pending}
      // `aria-disabled` além de `disabled` pelo mesmo motivo do login: botão
      // desabilitado some da ordem de foco no meio do envio.
      aria-disabled={pending}
    >
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Check aria-hidden />
          Salvar e entrar
        </>
      )}
    </Button>
  )
}

export function FormularioSenha() {
  const [estado, acao] = useActionState<EstadoSenha, FormData>(trocarSenha, {})

  return (
    // Sem `key` de remontagem, ao contrário dos formulários de cadastro. Ali
    // ela existe para devolver o que foi digitado; aqui não há o que devolver,
    // e remontar só trocaria os campos por outros no meio da digitação de quem
    // já estava corrigindo a senha.
    <form action={acao} className="space-y-4" noValidate>
      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          // `new-password` e não `current-password`: é o que faz o gerenciador
          // de senhas oferecer uma senha nova em vez de tentar preencher a
          // provisória que acabamos de invalidar.
          autoComplete="new-password"
          autoFocus
          erro={estado.campos?.senha}
          aria-describedby="ajuda-senha"
        />
        <p id="ajuda-senha" className="text-xs text-texto-fraco">
          Pelo menos 10 caracteres. Esta senha abre todas as distribuidoras.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmacao">Repita a nova senha</Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          erro={estado.campos?.confirmacao}
        />
      </div>

      <BotaoSalvar />
    </form>
  )
}
