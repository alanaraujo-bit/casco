'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { LogIn } from 'lucide-react'
import { AvisoErro } from '@/components/ui/aviso-erro'
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

      {/* `AvisoErro` cobre os dois formatos: a frase única de "e-mail ou
          senha incorretos" e a `Falha` estruturada de uma queda de conexão —
          ver `EstadoLogin`. */}
      <AvisoErro erro={estado.erro} />

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
