'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { LogIn, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { entrar, type EstadoLogin } from '@/modules/auth/acoes'

/**
 * Botão separado só para poder usar `useFormStatus`, que precisa estar dentro
 * do `<form>` para enxergar o envio. Sem o estado de "entrando", a pessoa com
 * internet ruim clica de novo, e de novo — e o balcão fica parado achando que
 * travou.
 */
function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      className="w-full"
      disabled={pending}
      // `aria-disabled` além de `disabled`: botão desabilitado some da ordem de
      // foco, e quem navega por teclado perde o lugar no meio do envio.
      aria-disabled={pending}
    >
      {pending ? (
        'Entrando…'
      ) : (
        <>
          <LogIn aria-hidden />
          Entrar
        </>
      )}
    </Button>
  )
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {})

  return (
    <form action={acao} className="space-y-4" noValidate>
      <input type="hidden" name="destino" value={destino} />

      {estado.erro && (
        // `role="alert"` porque o erro aparece depois do envio: sem ele, quem
        // usa leitor de tela clica em Entrar, nada é anunciado, e a página
        // parece não ter reagido.
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // Foca o campo ao abrir a tela. Quem entra todo dia de manhã já chega
          // digitando, sem passar pelo mouse.
          autoFocus
          defaultValue={estado.email}
          placeholder="voce@distribuidora.com.br"
          erro={estado.campos?.email}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          erro={estado.campos?.senha}
        />
      </div>

      <BotaoEntrar />
    </form>
  )
}
