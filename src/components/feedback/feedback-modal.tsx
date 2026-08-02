'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Check, MessageSquarePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { enviarFeedback } from '@/modules/feedback/acoes'
import { ROTULO_PRIORIDADE_FEEDBACK, ROTULO_TIPO_FEEDBACK } from '@/modules/feedback/esquema'
import { PRIORIDADES_FEEDBACK, TIPOS_FEEDBACK, type TipoFeedback } from '@/db/schema'
import { cn } from '@/lib/utils'

function BotaoEnviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar'}
    </Button>
  )
}

/**
 * Formulário de feedback, sempre remontado por `key={estado.tentativa}` —
 * mesmo padrão dos formulários de negócio: o React 19 limpa os campos quando
 * a action termina, e sem remontar os `defaultValue` não voltam depois de um
 * erro.
 */
function FormularioFeedback({ aoEnviar }: { aoEnviar: () => void }) {
  const [estado, enviar] = useActionState(enviarFeedback, {})
  const caminho = usePathname()
  const v = estado.valores ?? {}
  const [tipo, setTipo] = React.useState<TipoFeedback>((v.tipo as TipoFeedback) ?? 'bug')
  const erroDe = (campo: keyof NonNullable<typeof estado.campos>) => estado.campos?.[campo]

  React.useEffect(() => {
    if (estado.sucesso) {
      const t = setTimeout(aoEnviar, 1400)
      return () => clearTimeout(t)
    }
  }, [estado.sucesso, aoEnviar])

  if (estado.sucesso) {
    return (
      <div className="flex items-start gap-3 py-2 text-sucesso">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm font-medium">
          Recebemos o seu relato. Obrigado por ajudar a melhorar o sistema.
        </p>
      </div>
    )
  }

  return (
    <form key={estado.tentativa ?? 0} action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="rota" value={v.rota ?? caminho ?? ''} />
      <input type="hidden" name="codigoErro" value={v.codigoErro ?? ''} />

      <AvisoErro erro={estado.erro} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            id="tipo"
            name="tipo"
            defaultValue={tipo}
            onChange={(e) => setTipo(e.target.value as TipoFeedback)}
            erro={erroDe('tipo')}
          >
            {TIPOS_FEEDBACK.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_FEEDBACK[t]}
              </option>
            ))}
          </Select>
        </div>

        <div className={cn('space-y-1.5', tipo === 'sugestao' && 'opacity-40')}>
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select
            id="prioridade"
            name="prioridade"
            disabled={tipo === 'sugestao'}
            defaultValue={tipo === 'sugestao' ? '' : (v.prioridade ?? '')}
            erro={erroDe('prioridade')}
          >
            {tipo === 'sugestao' ? (
              <option value="">Não se aplica</option>
            ) : (
              <>
                <option value="">Escolha…</option>
                {PRIORIDADES_FEEDBACK.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PRIORIDADE_FEEDBACK[p]}
                  </option>
                ))}
              </>
            )}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          defaultValue={v.titulo ?? ''}
          erro={erroDe('titulo')}
          maxLength={120}
          placeholder="Resumo em uma linha"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          name="descricao"
          defaultValue={v.descricao ?? ''}
          erro={erroDe('descricao')}
          maxLength={2000}
          placeholder="O que aconteceu, ou o que você gostaria que o sistema fizesse."
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-borda pt-4">
        <BotaoEnviar />
      </div>
    </form>
  )
}

export function FeedbackModal() {
  const [aberto, setAberto] = React.useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Relatar bug ou sugerir melhoria"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-md md:size-9',
            'text-texto-suave hover:bg-superficie-hover hover:text-texto',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
          )}
        >
          <MessageSquarePlus className="size-5" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent
        titulo="Relatar um problema ou uma ideia"
        descricao="Vai direto para quem cuida do sistema."
      >
        <FormularioFeedback aoEnviar={() => setAberto(false)} />
      </DialogContent>
    </Dialog>
  )
}
