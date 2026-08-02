'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Save, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarConfig } from '@/modules/admin/acoes'
import type { EstadoConfig } from '@/modules/admin/esquema'

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          Salvar
        </>
      )}
    </Button>
  )
}

export function FormularioConfig({ inicial }: { inicial: string | null }) {
  const [estado, acao] = useActionState<EstadoConfig, FormData>(salvarConfig, {})

  return (
    // Sem `key` de remontagem: é um campo só, e remontar no meio da digitação
    // trocaria o valor por baixo de quem está colando a URL.
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

      {estado.ok && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md bg-sucesso-bg px-3 py-2.5 text-sm text-sucesso"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.ok}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="discordWebhookFeedback">Webhook do Discord</Label>
        <Input
          id="discordWebhookFeedback"
          name="discordWebhookFeedback"
          defaultValue={estado.valor ?? inicial ?? ''}
          erro={estado.campo}
          placeholder="https://discord.com/api/webhooks/…"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-texto-fraco">
          Para onde os relatos de bug, melhoria e sugestão são avisados. No Discord: Configurações
          do canal → Integrações → Webhooks → Novo Webhook → Copiar URL. Deixe em branco para
          desligar o aviso — os relatos continuam sendo gravados normalmente.
        </p>
      </div>

      <BotaoSalvar />
    </form>
  )
}
